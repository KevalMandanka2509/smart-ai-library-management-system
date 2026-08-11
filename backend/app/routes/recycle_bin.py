from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from ..database import get_db
from ..core.security import get_current_admin
from ..utils.audit import record_audit_log

router = APIRouter(prefix="/api/v1/backup/recycle-bin", tags=["Recycle Bin"])

@router.get("")
async def get_recycle_bin(
    collection: str = Query(..., description="Collection name (books, authors, etc.)"),
    page: int = 1,
    limit: int = 10,
    search: str = "",
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    valid_collections = {"books", "authors", "categories", "students", "fines"}
    if collection not in valid_collections:
        raise HTTPException(status_code=400, detail="Invalid collection")

    query = {"original_collection": collection}
    if search:
        query["display_name"] = {"$regex": search, "$options": "i"}

    skip = (page - 1) * limit
    cursor = db.recycle_bin.find(query).sort("deleted_at", -1).skip(skip).limit(limit)
    total = db.recycle_bin.count_documents(query)

    records = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Convert internal ObjectId for the record
        if "_id" in doc["record"]:
            doc["record"]["_id"] = str(doc["record"]["_id"])
        doc["id"] = doc["_id"]
        records.append(doc)

    return {
        "records": records,
        "page": page,
        "page_size": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit
    }

@router.delete("/{collection}/{record_id}")
async def permanent_delete(
    collection: str,
    record_id: str,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    res = db.recycle_bin.delete_one({"_id": ObjectId(record_id), "original_collection": collection})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found in recycle bin")

    record_audit_log(db, current_admin, "PERMANENT_DELETE", "System Recycle Bin", f"Permanently deleted a record from {collection}")
    return {"message": "Record permanently deleted"}

@router.delete("/{collection}/empty")
async def empty_recycle_bin(
    collection: str,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    res = db.recycle_bin.delete_many({"original_collection": collection})
    record_audit_log(db, current_admin, "EMPTY_RECYCLE_BIN", "System Recycle Bin", f"Emptied recycle bin for {collection} ({res.deleted_count} records)")
    return {"message": "Recycle bin emptied", "deleted_count": res.deleted_count}
@router.post("/{collection}/{record_id}/restore")
async def restore_record(
    collection: str,
    record_id: str,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    # 1. Get from recycle bin
    bin_record = db.recycle_bin.find_one({"_id": ObjectId(record_id), "original_collection": collection})
    if not bin_record:
        raise HTTPException(status_code=404, detail="Record not found in recycle bin")

    # 2. Extract original record and ensure _id is properly cast
    original_record = bin_record["record"]
    if "_id" in original_record and isinstance(original_record["_id"], str):
        original_record["_id"] = ObjectId(original_record["_id"])
    
    # 3. Check for duplicates manually before restoring
    import re
    if collection == "books":
        if db.books.find_one({"isbn": original_record.get("isbn")}):
            raise HTTPException(status_code=400, detail="Cannot restore: A book with this ISBN already exists.")
    elif collection == "students":
        if db.students.find_one({"student_id": original_record.get("student_id")}):
            raise HTTPException(status_code=400, detail="Cannot restore: A student with this ID already exists.")
        if original_record.get("email"):
            if db.students.find_one({"email": original_record.get("email", "").lower()}):
                raise HTTPException(status_code=400, detail="Cannot restore: A student with this email already exists.")
    elif collection == "authors":
        name = original_record.get("name")
        if db.authors.find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}, "is_deleted": {"$ne": True}}):
            raise HTTPException(status_code=400, detail="Cannot restore: An author with this name already exists.")
    elif collection == "categories":
        name = original_record.get("name")
        if db.categories.find_one({"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}, "is_deleted": {"$ne": True}}):
            raise HTTPException(status_code=400, detail="Cannot restore: A category with this name already exists.")
            
    # 4. Insert back into original collection
    try:
        db[collection].insert_one(original_record)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail=f"Cannot restore: A record with the same unique identifier (like ISBN, Email, or ID) already exists in the {collection} collection.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore record: {str(e)}")

    # 4. Remove from recycle bin
    db.recycle_bin.delete_one({"_id": ObjectId(record_id)})

    # 5. Log it
    record_audit_log(db, current_admin, "RESTORE_RECORD", "System Recycle Bin", f"Restored a record to {collection}")
    return {"message": "Record restored successfully"}
