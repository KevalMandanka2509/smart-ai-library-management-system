from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import asyncio
from ..utils.notification_helper import create_notification
from typing import List, Optional

from ..database import get_db
from ..schemas.borrow import BorrowIssueRequest, BorrowReturnRequest, BorrowResponse
from ..core.security import get_current_user
from ..core.rbac import has_permission

router = APIRouter(prefix="/api/v1/borrows", tags=["Borrow Transactions"])

def serialize_borrow(borrow) -> dict:
    return {
        "id": str(borrow.get("_id", "")),
        "student_id": borrow.get("student_id", ""),
        "student_name": borrow.get("student_name", "Unknown Student"),
        "book_id": borrow.get("book_id", ""),
        "book_title": borrow.get("book_title", "Unknown Book"),
        "issue_date": borrow.get("issue_date"),
        "due_date": borrow.get("due_date"),
        "return_date": borrow.get("return_date"),
        "status": borrow.get("status", "unknown")
    }

def serialize_borrows(borrows) -> list:
    return [serialize_borrow(b) for b in borrows]

# ============================================
# 1. ISSUE BOOK (Admin Only)
# ============================================
@router.post("/issue", response_model=dict)
async def issue_book(request: BorrowIssueRequest, db=Depends(get_db), current_user=Depends(has_permission("borrows:manage"))):
    """
    Issue a book to a student.
    """
    # P1-11: Read library settings
    from ..utils.settings_helper import get_library_settings
    lib_settings = get_library_settings(db)
    
    # 1. Verify student exists and is active
    student = db.students.find_one({"student_id": request.student_id})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID '{request.student_id}' not found"
        )
    if not student.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student account is disabled"
        )

    # P1-11: Enforce max_books_per_student
    active_borrows_count = db.borrows.count_documents({"student_id": request.student_id, "status": "issued"})
    max_books = lib_settings["max_books_per_student"]
    if active_borrows_count >= max_books:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student has reached the maximum borrow limit ({max_books} books). Return a book first."
        )

    # P1-11: Check for unpaid fines with threshold enforcement
    if lib_settings["block_borrow_on_unpaid_fine"]:
        pipeline = [{"$match": {"student_id": request.student_id, "paid": False}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
        fine_result = list(db.fines.aggregate(pipeline))
        total_unpaid = fine_result[0]["total"] if fine_result else 0
        if total_unpaid > lib_settings["max_fine_limit_for_borrow"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Student has unpaid fines ({lib_settings['currency_symbol']}{total_unpaid:.2f}) exceeding the limit ({lib_settings['currency_symbol']}{lib_settings['max_fine_limit_for_borrow']:.2f}). Please clear them first."
            )

    book_filter = {}
    if ObjectId.is_valid(request.book_id):
        book_filter["_id"] = ObjectId(request.book_id)
    else:
        book_filter["$or"] = [
            {"isbn": request.book_id},
            {"barcode_value": request.book_id},
            {"qr_value": request.book_id},
            {"title": {"$regex": f"^{request.book_id}$", "$options": "i"}}
        ]
        
    book = db.books.find_one(book_filter)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book matching '{request.book_id}' not found"
        )

    # 3. Check reservations and available copies
    available_copies = book.get("available_copies", 0)
    
    # Check if this student has a 'ready' reservation
    ready_res = db.reservations.find_one({
        "book_id": str(book["_id"]),
        "student_id": request.student_id,
        "status": "ready"
    })
    
    # Check if there are other 'ready' reservations
    other_ready_res = db.reservations.find_one({
        "book_id": str(book["_id"]),
        "status": "ready",
        "student_id": {"$ne": request.student_id}
    })

    if other_ready_res and available_copies <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This book is held for another student's pending reservation."
        )

    if not ready_res and available_copies <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This book has no copies available for issue."
        )

    # 5. Check if student already has this book issued
    existing_issue = db.borrows.find_one({
        "student_id": request.student_id,
        "book_id": str(book["_id"]),
        "status": "issued"
    })
    if existing_issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This book is already issued to this student"
        )

    # 6. Update book availability counter and fulfill reservation if applicable
    from pymongo import ReturnDocument
    if ready_res:
        # Fulfill reservation atomically
        updated_res = db.reservations.find_one_and_update(
            {"_id": ready_res["_id"], "status": "ready"},
            {"$set": {"status": "completed"}},
            return_document=ReturnDocument.AFTER
        )
        if not updated_res:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reservation is no longer valid or has already been fulfilled."
            )
    else:
        # Atomic decrement available copies normally
        result = db.books.find_one_and_update(
            {"_id": book["_id"], "available_copies": {"$gt": 0}},
            {"$inc": {"available_copies": -1}},
            return_document=ReturnDocument.AFTER
        )
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This book has no copies available for issue."
            )
        if result["available_copies"] == 0:
            db.books.update_one(
                {"_id": book["_id"]},
                {"$set": {"is_available": False}}
            )

    # 7. Insert transaction record (failure-safe: rollback inventory on error)
    # P1-11: Use default_borrow_days from settings
    borrow_days = lib_settings["default_borrow_days"]
    new_borrow = {
        "student_id": request.student_id,
        "student_name": student["full_name"],
        "book_id": str(book["_id"]),
        "book_title": book["title"],
        "issue_date": datetime.now(timezone.utc).replace(tzinfo=None),
        "due_date": datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=borrow_days),
        "return_date": None,
        "status": "issued",
        "renew_count": 0
    }
    
    from pymongo.errors import DuplicateKeyError
    try:
        db.borrows.insert_one(new_borrow)
    except DuplicateKeyError:
        # P1-7: Concurrent duplicate caught by unique partial index
        if ready_res:
            db.reservations.update_one({"_id": ready_res["_id"]}, {"$set": {"status": "ready"}})
        else:
            db.books.update_one({"_id": book["_id"]}, {"$inc": {"available_copies": 1}, "$set": {"is_available": True}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This book is already issued to this student"
        )
    except Exception as insert_err:
        # Rollback: restore inventory or reservation status
        if ready_res:
            db.reservations.update_one(
                {"_id": ready_res["_id"]},
                {"$set": {"status": "ready"}}
            )
        else:
            db.books.update_one(
                {"_id": book["_id"]},
                {"$inc": {"available_copies": 1}, "$set": {"is_available": True}}
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create borrow record. Inventory has been restored."
        )

    # 7. Trigger notification & email
    asyncio.create_task(create_notification(
        db,
        student_id=request.student_id,
        title="Book Issued Successfully",
        message=f"You have borrowed '{book['title']}'. Due date is {new_borrow['due_date'].strftime('%Y-%m-%d')}.",
        n_type="issue_success",
        student_name=student.get("full_name", request.student_id),
        book_title=book["title"],
        issue_date=new_borrow["issue_date"].strftime("%Y-%m-%d"),
        due_date=new_borrow["due_date"].strftime("%Y-%m-%d")
    ))

    return {"message": f"Book '{book['title']}' successfully issued to '{student['full_name']}'"}

# ============================================
# 2. RETURN BOOK (Admin Only)
# ============================================
@router.post("/return", response_model=dict)
async def return_book(request: BorrowReturnRequest, db=Depends(get_db), current_user=Depends(has_permission("borrows:manage"))):
    """
    Return an issued book. Calculates fines and processes reservations.
    """
    # 1. Match active issue record
    book_filter = {}
    if ObjectId.is_valid(request.book_id):
        book_filter["_id"] = ObjectId(request.book_id)
    else:
        book_filter["$or"] = [
            {"isbn": request.book_id},
            {"barcode_value": request.book_id},
            {"qr_value": request.book_id},
            {"title": {"$regex": f"^{request.book_id}$", "$options": "i"}}
        ]
        
    book = db.books.find_one(book_filter)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    borrow = db.borrows.find_one_and_update(
        {
            "student_id": request.student_id,
            "book_id": str(book["_id"]),
            "status": "issued"
        },
        {
            "$set": {
                "status": "returned",
                "return_date": now
            }
        }
    )
    
    if not borrow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active borrow record found for this student and book. It may have already been returned."
        )

    # P1-11/13: Calculate late fine with settings enforcement
    from ..utils.settings_helper import get_library_settings
    lib_settings = get_library_settings(db)
    fine_amount = 0.0
    overdue_days = 0
    due_date = borrow["due_date"]
    grace_days = lib_settings["grace_period_days"]
    
    if now > due_date:
        raw_overdue_days = (now - due_date).days
        if raw_overdue_days == 0 and (now - due_date).total_seconds() > 0:
            raw_overdue_days = 1
        # P1-11: Apply grace period
        overdue_days = max(0, raw_overdue_days - grace_days)
        if overdue_days > 0:
            fine_rate = lib_settings["daily_fine_rate"]
            fine_amount = overdue_days * fine_rate
            # P1-13: Cap fine at max_fine_per_book
            max_fine = lib_settings["max_fine_per_book"]
            if fine_amount > max_fine:
                fine_amount = max_fine

    # 4. Save fine record if applicable
    currency = lib_settings["currency_symbol"]
    if fine_amount > 0:
        db.fines.insert_one({
            "borrow_id": str(borrow["_id"]),
            "student_id": borrow["student_id"],
            "student_name": borrow.get("student_name", "Unknown Student"),
            "book_title": borrow.get("book_title", "Unknown Book"),
            "amount": fine_amount,
            "reason": f"Overdue return ({overdue_days} day(s) late, {grace_days}-day grace applied)",
            "created_at": now,
            "paid": False,
            "paid_at": None
        })

    # 5. Check reservation queue atomically
    oldest_res = db.reservations.find_one_and_update(
        {"book_id": str(book["_id"]), "status": "pending"},
        {"$set": {"status": "ready", "ready_at": now}},
        sort=[("reserved_at", 1)]
    )
    
    from ..utils.notification_helper import create_notification
    from ..services.email_service import EmailService
    import asyncio

    if oldest_res:
        # Assigned copy directly to the reserver (do not increment available_copies)
        msg = f"Book '{book['title']}' returned. Held for reserver '{oldest_res['student_name']}'."
        # Notify the reserver
        asyncio.create_task(create_notification(
            db,
            student_id=oldest_res["student_id"],
            title="Reserved Book Ready for Pickup",
            message=f"The book '{book['title']}' you reserved is now ready for pickup.",
            n_type="reservation_update"
        ))
    else:
        # Increment book availability normally
        db.books.update_one(
            {"_id": book["_id"]},
            {
                "$inc": {"available_copies": 1},
                "$set": {"is_available": True}
            }
        )
        msg = f"Book '{book['title']}' successfully returned."

    # Notify borrower of return success & send return confirmation email
    student = db.students.find_one({"student_id": request.student_id})
    
    asyncio.create_task(create_notification(
        db,
        student_id=request.student_id,
        title="Book Returned Successfully",
        message=f"Book '{book['title']}' has been returned.",
        n_type="return_success",
        student_name=student.get("full_name", request.student_id) if student else request.student_id,
        book_title=book["title"],
        return_date=now.strftime("%Y-%m-%d %H:%M")
    ))

    # Notify borrower of late fine if generated
    if fine_amount > 0:
        msg += f" Late return fine of {currency}{fine_amount:.2f} generated."
        asyncio.create_task(create_notification(
            db,
            student_id=request.student_id,
            title="Overdue Fine Generated",
            message=f"A late fee of {currency}{fine_amount:.2f} has been generated for returning '{book['title']}' late.",
            n_type="fine_reminder",
            student_name=student.get("full_name", request.student_id) if student else request.student_id,
            book_title=book["title"],
            amount=fine_amount,
            reason="Late Book Return"
        ))

    return {"message": msg}

# ============================================
# 2b. RENEW BOOK (P1-12)
# ============================================
@router.post("/renew", response_model=dict)
async def renew_book(request: BorrowIssueRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    """
    Renew an active borrow. Extends the due date.
    """
    from ..utils.settings_helper import get_library_settings
    lib_settings = get_library_settings(db)
    
    if not lib_settings["allow_renewals"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Book renewals are currently disabled.")
    
    # Authorization: members can only renew their own borrows
    student_id = request.student_id
    if current_user.get("role") == "member":
        if student_id != current_user.get("username"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only renew your own borrows.")
    
    # Find the active borrow
    book_id = request.book_id
    borrow_filter = {"student_id": student_id, "status": "issued"}
    if ObjectId.is_valid(book_id):
        borrow_filter["book_id"] = book_id
    else:
        # Try to resolve book_id from ISBN/barcode
        book = db.books.find_one({"$or": [{"isbn": book_id}, {"barcode_value": book_id}]})
        if book:
            borrow_filter["book_id"] = str(book["_id"])
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    
    borrow = db.borrows.find_one(borrow_filter)
    if not borrow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active borrow found for this book.")
    
    # Check renew count
    renew_count = borrow.get("renew_count", 0)
    max_renewals = lib_settings["max_renew_count"]
    if renew_count >= max_renewals:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Maximum renewal limit ({max_renewals}) reached.")
    
    # Check if book is overdue — don't allow renewal if overdue
    if borrow["due_date"] < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot renew an overdue book. Please return it first.")
    
    # Check for conflicting reservations
    actual_book_id = borrow["book_id"]
    pending_res = db.reservations.find_one({"book_id": actual_book_id, "status": {"$in": ["pending", "ready"]}})
    if pending_res:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot renew — there are active reservations for this book.")
    
    # Extend due date
    new_due = borrow["due_date"] + timedelta(days=lib_settings["default_borrow_days"])
    from pymongo import ReturnDocument
    updated = db.borrows.find_one_and_update(
        {"_id": borrow["_id"], "status": "issued"},
        {"$set": {"due_date": new_due}, "$inc": {"renew_count": 1}},
        return_document=ReturnDocument.AFTER
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Renewal failed. Borrow may have been returned.")
    
    return {
        "message": f"Book renewed successfully. New due date: {new_due.strftime('%Y-%m-%d')}",
        "new_due_date": new_due.isoformat(),
        "renew_count": updated.get("renew_count", renew_count + 1)
    }

# ============================================
# 3. LIST ALL TRANSACTIONS (Admin Only - Filtered, Sorted, Paginated)
# ============================================
@router.get("/transactions", response_model=dict)
async def get_transactions(
    query: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db=Depends(get_db),
    current_user=Depends(has_permission("borrows:manage"))
):
    search_filter = {}
    if status:
        search_filter["status"] = status

    if overdue:
        search_filter["status"] = "issued"
        search_filter["due_date"] = {"$lt": datetime.now(timezone.utc).replace(tzinfo=None)}

    if query and query.strip():
        q = query.strip()
        search_filter["$or"] = [
            {"student_id": {"$regex": q, "$options": "i"}},
            {"student_name": {"$regex": q, "$options": "i"}},
            {"book_title": {"$regex": q, "$options": "i"}},
            {"book_id": {"$regex": q, "$options": "i"}}
        ]

    total = db.borrows.count_documents(search_filter)
    total_pages = max(1, -(-total // page_size))
    skip = (page - 1) * page_size

    cursor = db.borrows.find(search_filter).sort("issue_date", -1).skip(skip).limit(page_size)
    return {
        "transactions": serialize_borrows(list(cursor)),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

# ============================================
# 3b. BULK RETURN BOOKS (Admin Only)
# ============================================
@router.post("/bulk-return", response_model=dict)
async def bulk_return_books(
    payload: dict,
    db=Depends(get_db),
    current_user=Depends(has_permission("borrows:manage"))
):
    """
    Process returns for multiple active borrowing records.
    Payload format: { "transaction_ids": ["tx_id1", "tx_id2", ...] }
    """
    tx_ids = payload.get("transaction_ids", [])
    if not tx_ids or not isinstance(tx_ids, list):
        raise HTTPException(
            status_code=400,
            detail="transaction_ids must be a non-empty list"
        )

    tx_obj_ids = [ObjectId(tx_id) for tx_id in tx_ids if ObjectId.is_valid(tx_id)]
    if not tx_obj_ids:
        return {"message": "Successfully processed returns for 0 transaction(s)"}

    # Fetch all active borrows in one go
    borrows = list(db.borrows.find({"_id": {"$in": tx_obj_ids}, "status": "issued"}))
    if not borrows:
        return {"message": "Successfully processed returns for 0 transaction(s)"}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    valid_tx_ids = [b["_id"] for b in borrows]
    
    # Mark them returned in bulk
    db.borrows.update_many(
        {"_id": {"$in": valid_tx_ids}},
        {"$set": {"status": "returned", "return_date": now}}
    )

    # Fetch all books in one go
    book_ids = list(set([ObjectId(b["book_id"]) for b in borrows if ObjectId.is_valid(b["book_id"])]))
    books = list(db.books.find({"_id": {"$in": book_ids}}))
    books_map = {str(b["_id"]): b for b in books}

    from ..utils.fine_config import get_fine_rate
    fine_rate = get_fine_rate(db)

    from ..utils.notification_helper import create_notification
    import asyncio
    
    fines_to_insert = []
    
    for borrow in borrows:
        book_id_str = borrow["book_id"]
        book = books_map.get(book_id_str)
        if not book: continue

        # Calculate late fine
        fine_amount = 0.0
        due_date = borrow["due_date"]
        if now > due_date:
            overdue_days = (now - due_date).days
            if overdue_days == 0 and (now - due_date).total_seconds() > 0:
                overdue_days = 1
            if overdue_days > 0:
                fine_amount = overdue_days * fine_rate

        # Save fine record if applicable
        if fine_amount > 0:
            fines_to_insert.append({
                "borrow_id": str(borrow["_id"]),
                "student_id": borrow["student_id"],
                "student_name": borrow.get("student_name", "Unknown Student"),
                "book_title": borrow.get("book_title", "Unknown Book"),
                "amount": fine_amount,
                "reason": f"Overdue return ({overdue_days} day(s) late)",
                "created_at": now,
                "paid": False,
                "paid_at": None
            })

        # Check reservation queue atomically
        oldest_res = db.reservations.find_one_and_update(
            {"book_id": book_id_str, "status": "pending"},
            {"$set": {"status": "ready", "ready_at": now}},
            sort=[("reserved_at", 1)]
        )
        
        if oldest_res:
            asyncio.create_task(create_notification(db, student_id=oldest_res["student_id"], title="Reserved Book Ready for Pickup", message=f"The book '{book['title']}' you reserved is now ready for pickup.", n_type="reservation_update"))
        else:
            db.books.update_one({"_id": ObjectId(book_id_str)}, {"$inc": {"available_copies": 1}, "$set": {"is_available": True}})

    if fines_to_insert:
        db.fines.insert_many(fines_to_insert)

    return {"message": f"Successfully processed returns for {len(borrows)} transaction(s)"}


# ============================================
# 4. LIST BY STUDENT (Registered Users)
# ============================================
STUDENT_BORROW_PROJ = {
    "student_id": 1, "student_name": 1, "book_id": 1,
    "book_title": 1, "issue_date": 1, "due_date": 1,
    "return_date": 1, "status": 1
}

@router.get("/student/{student_id}", response_model=List[dict])
async def get_student_borrows(
    student_id: str, 
    db=Depends(get_db), 
    current_user=Depends(get_current_user)
):
    if current_user.get("role") == "member":
        if student_id != current_user.get("username"):
            raise HTTPException(status_code=403, detail="You are not authorized to view this student's records")

    borrows = db.borrows.find(
        {"student_id": student_id}, STUDENT_BORROW_PROJ
    ).sort("issue_date", -1).limit(200)
    return serialize_borrows(list(borrows))

# ============================================
# 5. GET STATS/REPORTS (Admin Only)
# ============================================
@router.get("/reports")
async def get_reports_stats(db=Depends(get_db), current_user=Depends(has_permission("borrows:manage"))):
    # Single aggregation instead of 3 separate count_documents calls
    pipeline = [
        {"$facet": {
            "issued": [{"$match": {"status": "issued"}}, {"$count": "n"}],
            "returned": [{"$match": {"status": "returned"}}, {"$count": "n"}],
            "overdue": [{"$match": {"status": "issued", "due_date": {"$lt": datetime.now(timezone.utc).replace(tzinfo=None)}}}, {"$count": "n"}]
        }}
    ]
    result = list(db.borrows.aggregate(pipeline))
    r = result[0] if result else {}
    total_issued = r.get("issued", [{}])[0].get("n", 0) if r.get("issued") else 0
    total_returned = r.get("returned", [{}])[0].get("n", 0) if r.get("returned") else 0
    overdue_count = r.get("overdue", [{}])[0].get("n", 0) if r.get("overdue") else 0
    
    return {
        "total_issued": total_issued,
        "total_returned": total_returned,
        "overdue_count": overdue_count,
        "total_transactions": total_issued + total_returned
    }
