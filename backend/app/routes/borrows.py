from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timedelta
from bson import ObjectId
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
            detail=f"Student account is disabled"
        )

    # 1b. Check for unpaid fines
    unpaid_fine = db.fines.find_one({"student_id": request.student_id, "paid": False})
    if unpaid_fine:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student has unpaid fines. Please clear them before issuing a book."
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
    new_borrow = {
        "student_id": request.student_id,
        "student_name": student["full_name"],
        "book_id": str(book["_id"]),
        "book_title": book["title"],
        "issue_date": datetime.utcnow(),
        "due_date": datetime.utcnow() + timedelta(days=14),
        "return_date": None,
        "status": "issued"
    }
    
    try:
        db.borrows.insert_one(new_borrow)
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
    from ..utils.notification_helper import create_notification
    from ..services.email_service import EmailService
    import asyncio

    asyncio.create_task(create_notification(
        db,
        student_id=request.student_id,
        title="Book Issued Successfully",
        message=f"You have borrowed '{book['title']}'. Due date is {new_borrow['due_date'].strftime('%Y-%m-%d')}.",
        n_type="issue_success"
    ))

    if student.get("email"):
        asyncio.create_task(EmailService.send_issue_confirmation(
            recipient_email=student["email"],
            student_name=student.get("full_name", request.student_id),
            book_title=book["title"],
            issue_date=new_borrow["issue_date"].strftime("%Y-%m-%d"),
            due_date=new_borrow["due_date"].strftime("%Y-%m-%d"),
            db=db
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

    now = datetime.utcnow()
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

    # 2. Calculate late fine
    fine_amount = 0.0
    due_date = borrow["due_date"]
    if now > due_date:
        overdue_days = (now - due_date).days
        if overdue_days == 0 and (now - due_date).total_seconds() > 0:
            overdue_days = 1
        if overdue_days > 0:
            from ..utils.fine_config import get_fine_rate
            fine_rate = get_fine_rate(db)
            fine_amount = overdue_days * fine_rate

    # 4. Save fine record if applicable
    if fine_amount > 0:
        db.fines.insert_one({
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

    # 5. Check reservation queue atomically
    oldest_res = db.reservations.find_one_and_update(
        {"book_id": str(book["_id"]), "status": "pending"},
        {"$set": {"status": "ready"}},
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
    asyncio.create_task(create_notification(
        db,
        student_id=request.student_id,
        title="Book Returned Successfully",
        message=f"Book '{book['title']}' has been returned.",
        n_type="return_success"
    ))

    student = db.students.find_one({"student_id": request.student_id})
    if student and student.get("email"):
        asyncio.create_task(EmailService.send_return_confirmation(
            recipient_email=student["email"],
            student_name=student.get("full_name", request.student_id),
            book_title=book["title"],
            return_date=now.strftime("%Y-%m-%d %H:%M"),
            db=db
        ))
        if fine_amount > 0:
            asyncio.create_task(EmailService.send_fine_reminder(
                recipient_email=student["email"],
                student_name=student.get("full_name", request.student_id),
                book_title=book["title"],
                amount=fine_amount,
                reason="Late Book Return",
                db=db
            ))

    # Notify borrower of late fine if generated
    if fine_amount > 0:
        msg += f" Late return fine of {fine_amount} units generated."
        asyncio.create_task(create_notification(
            db,
            student_id=request.student_id,
            title="Overdue Fine Generated",
            message=f"A late fee of ${fine_amount:.2f} has been generated for returning '{book['title']}' late.",
            n_type="fine_reminder"
        ))

    return {"message": msg}

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
        search_filter["due_date"] = {"$lt": datetime.utcnow()}

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

    processed_count = 0
    now = datetime.utcnow()
    from ..utils.notification_helper import create_notification
    import asyncio
    
    for tx_id in tx_ids:
        if not ObjectId.is_valid(tx_id): continue
        borrow = db.borrows.find_one_and_update(
            {"_id": ObjectId(tx_id), "status": "issued"},
            {"$set": {"status": "returned", "return_date": now}}
        )
        if not borrow: continue
        
        book_id = borrow["book_id"]
        book = db.books.find_one({"_id": ObjectId(book_id)})
        if not book: continue

        # 2. Calculate late fine
        fine_amount = 0.0
        due_date = borrow["due_date"]
        if now > due_date:
            overdue_days = (now - due_date).days
            if overdue_days == 0 and (now - due_date).total_seconds() > 0:
                overdue_days = 1
            if overdue_days > 0:
                from ..utils.fine_config import get_fine_rate
                fine_rate = get_fine_rate(db)
                fine_amount = overdue_days * fine_rate

        # 4. Save fine record if applicable
        if fine_amount > 0:
            db.fines.insert_one({
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

        # 5. Check reservation queue atomically
        oldest_res = db.reservations.find_one_and_update(
            {"book_id": str(book["_id"]), "status": "pending"},
            {"$set": {"status": "ready"}},
            sort=[("reserved_at", 1)]
        )
        
        if oldest_res:
            asyncio.create_task(create_notification(db, student_id=oldest_res["student_id"], title="Reserved Book Ready for Pickup", message=f"The book '{book['title']}' you reserved is now ready for pickup.", n_type="reservation_update"))
        else:
            db.books.update_one({"_id": book["_id"]}, {"$inc": {"available_copies": 1}, "$set": {"is_available": True}})

        processed_count += 1

    return {"message": f"Successfully processed returns for {processed_count} transaction(s)"}

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
            "overdue": [{"$match": {"status": "issued", "due_date": {"$lt": datetime.utcnow()}}}, {"$count": "n"}]
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
