from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from ..database import get_db
from ..core.security import get_current_user
from ..core.rbac import has_permission

router = APIRouter(prefix="/api/v1/contact", tags=["contact"])

class ContactCreate(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str

class ContactResponse(BaseModel):
    id: str
    name: str
    email: str
    subject: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def submit_contact_message(message: ContactCreate, db = Depends(get_db)):
    doc = message.model_dump()
    doc["is_read"] = False
    doc["created_at"] = datetime.utcnow()
    
    result = db.contact_messages.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["_id"] = str(result.inserted_id)
    return doc

@router.get("/", response_model=List[ContactResponse])
def get_contact_messages(skip: int = 0, limit: int = 100, db = Depends(get_db), current_user = Depends(has_permission("contact:manage"))):
    cursor = db.contact_messages.find().sort("created_at", -1).skip(skip).limit(limit)
    messages = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        doc.setdefault("name", f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip() or "Unknown")
        doc.setdefault("subject", "No Subject")
        doc.setdefault("is_read", doc.get("status") == "read" or False)
        messages.append(doc)
    return messages

@router.put("/{message_id}/read", response_model=ContactResponse)
def mark_message_read(message_id: str, db = Depends(get_db), current_user = Depends(has_permission("contact:manage"))):
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID")
        
    doc = db.contact_messages.find_one_and_update(
        {"_id": ObjectId(message_id)},
        {"$set": {"is_read": True, "status": "read"}},
        return_document=True
    )
    
    if not doc:
        raise HTTPException(status_code=404, detail="Message not found")
        
    doc["id"] = str(doc["_id"])
    doc.setdefault("name", f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip() or "Unknown")
    doc.setdefault("subject", "No Subject")
    doc.setdefault("is_read", True)
    return doc

@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact_message(message_id: str, db = Depends(get_db), current_user = Depends(has_permission("contact:manage"))):
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=400, detail="Invalid message ID")
        
    result = db.contact_messages.delete_one({"_id": ObjectId(message_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return None
