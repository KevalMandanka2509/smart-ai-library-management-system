from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from bson import ObjectId
from typing import List

from ..database import get_db
from ..schemas.fine import FinePayRequest
from ..core.security import get_current_user, get_current_admin
from ..utils.fine_config import get_fine_rate

router = APIRouter(prefix="/api/v1/fines", tags=["Fines"])

def serialize_fine(fine) -> dict:
    return {
        "id": str(fine["_id"]),
        "borrow_id": fine["borrow_id"],
        "student_id": fine["student_id"],
        "student_name": fine.get("student_name", "Unknown Student"),
        "book_title": fine.get("book_title", "Unknown Book"),
        "amount": fine["amount"],
        "reason": fine.get("reason", "Late Return"),
        "created_at": fine["created_at"],
        "paid": fine["paid"],
        "paid_at": fine.get("paid_at")
    }

# ============================================
# 1. GET FINES (Active / All) — Paginated
# ============================================
FINE_LIST_PROJ = {
    "borrow_id": 1, "student_id": 1, "student_name": 1,
    "book_title": 1, "amount": 1, "reason": 1,
    "created_at": 1, "paid": 1, "paid_at": 1
}

@router.get("/", response_model=dict)
async def get_fines(
    paid: bool = False,
    page: int = 1,
    page_size: int = 50,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    is_admin = current_user.get("role") == "admin"
    query = {"paid": paid}
    
    if not is_admin:
        query["student_id"] = current_user.get("username")

    # 1. Fetch DB Fines and append dynamic total for consistent pagination
    total = db.fines.count_documents(query)
    
    if not paid:
        now = datetime.utcnow()
        borrow_query = {"status": "issued", "due_date": {"$lt": now}}
        if not is_admin:
            borrow_query["student_id"] = current_user.get("username")
        # Note: Some borrows may have exactly 0 full days overdue, but the db query filters strictly `< now`.
        # The small discrepancy is acceptable for pagination totals.
        total += db.borrows.count_documents(borrow_query)

    total_pages = max(1, -(-total // page_size))
    skip = (page - 1) * page_size
        
    fines = db.fines.find(query, FINE_LIST_PROJ).sort("created_at", -1).skip(skip).limit(page_size)
    serialized_fines = [serialize_fine(f) for f in fines]

    # 2. Add Dynamic Accumulating Fines (only on page 1 for unpaid)
    if not paid and page == 1:
        overdue_borrows = db.borrows.find(borrow_query)
        for b in overdue_borrows:
            due = b.get("due_date")
            if not due: continue
            overdue_days = (now - due).days
            if overdue_days == 0 and (now - due).total_seconds() > 0:
                overdue_days = 1
            if overdue_days > 0:
                serialized_fines.insert(0, {
                    "id": "dyn_" + str(b["_id"]),
                    "borrow_id": str(b["_id"]),
                    "student_id": b.get("student_id", ""),
                    "student_name": b.get("student_name", "Unknown Student"),
                    "book_title": b.get("book_title", "Unknown Book"),
                    "amount": overdue_days * get_fine_rate(db),
                    "reason": f"Accumulating ({overdue_days} days late)",
                    "created_at": now,
                    "paid": False,
                    "paid_at": None
                })

    return {
        "fines": serialized_fines,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

# ============================================
# 2. PAY A FINE
# ============================================
@router.post("/pay", response_model=dict)
async def pay_fine(request: FinePayRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(request.fine_id):
        raise HTTPException(status_code=400, detail="Invalid fine ID")
        
    fine = db.fines.find_one({"_id": ObjectId(request.fine_id)})
    if not fine:
        raise HTTPException(status_code=404, detail="Fine record not found")
        
    # Check permissions
    is_admin = current_user.get("role") == "admin"
    if not is_admin and fine["student_id"] != current_user.get("username"):
        raise HTTPException(status_code=403, detail="Not authorized to pay this fine")

    db.fines.update_one(
        {"_id": ObjectId(request.fine_id)},
        {
            "$set": {
                "paid": True,
                "paid_at": datetime.utcnow()
            }
        }
    )
    return {"message": "Fine paid successfully!"}

