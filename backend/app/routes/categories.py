from fastapi import APIRouter, Depends, HTTPException, Query, status
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
import re
import logging

from ..database import get_db
from ..models.category import category_document, serialize_category, serialize_categories
from ..schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from ..core.security import get_current_user
from ..core.rbac import has_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/categories", tags=["Categories"])


# ============================================
# 1. CREATE CATEGORY - Add New Category (Admin Only)
# ============================================
@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category: CategoryCreate,
    db=Depends(get_db),
    current_user=Depends(has_permission("categories:write"))
):
    """
    Add a new category to the library.
    - Checks if a category with the same name already exists (case-insensitive)
    - Creates new category entry
    """
    collection = db.categories

    # Check for duplicate name (case-insensitive, excluding soft-deleted)
    existing = collection.find_one({
        "name": {"$regex": f"^{re.escape(category.name)}$", "$options": "i"},
        "is_deleted": {"$ne": True}
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with name '{category.name}' already exists"
        )

    # Create new category document
    new_category = category_document(category.dict())

    # Insert into MongoDB
    result = collection.insert_one(new_category)

    # Get inserted category
    inserted = collection.find_one({"_id": result.inserted_id})

    logger.info(f"✅ Category created: {category.name} (ID: {result.inserted_id})")
    return serialize_category(inserted)


# ============================================
# 2. GET ALL CATEGORIES - With Pagination & Search
# ============================================
@router.get("/", response_model=List[CategoryResponse])
async def get_all_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None, max_length=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get all categories with pagination and optional search/status filter.
    Only returns non-deleted categories.
    """
    collection = db.categories

    # Build query filter — always exclude soft-deleted
    query = {"is_deleted": {"$ne": True}}

    if search and search.strip():
        query["name"] = {"$regex": re.escape(search.strip()), "$options": "i"}

    if status_filter and status_filter in ("active", "inactive"):
        query["status"] = status_filter

    categories = collection.find(query).sort("name", 1).skip(skip).limit(limit)
    total = collection.count_documents(query)

    result = serialize_categories(list(categories))

    return result


# ============================================
# 3. GET CATEGORY STATS
# ============================================
@router.get("/stats/")
async def get_category_stats(
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get category statistics"""
    collection = db.categories
    base_filter = {"is_deleted": {"$ne": True}}

    total = collection.count_documents(base_filter)
    active = collection.count_documents({**base_filter, "status": "active"})
    inactive = collection.count_documents({**base_filter, "status": "inactive"})

    return {
        "total_categories": total,
        "active_categories": active,
        "inactive_categories": inactive
    }


# ============================================
# 4. GET CATEGORY DETAILS - View Single Category
# ============================================
@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: str,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get detailed information about a specific category.
    """
    collection = db.categories

    # Validate ObjectId
    if not ObjectId.is_valid(category_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category ID format"
        )

    category = collection.find_one({
        "_id": ObjectId(category_id),
        "is_deleted": {"$ne": True}
    })

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found"
        )

    return serialize_category(category)


# ============================================
# 5. UPDATE CATEGORY - Update Category Details (Admin Only)
# ============================================
@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    category_update: CategoryUpdate,
    db=Depends(get_db),
    current_user=Depends(has_permission("categories:write"))
):
    """
    Update category details.
    """
    collection = db.categories

    # Validate ObjectId
    if not ObjectId.is_valid(category_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category ID format"
        )

    # Check if category exists and is not soft-deleted
    category = collection.find_one({
        "_id": ObjectId(category_id),
        "is_deleted": {"$ne": True}
    })
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found"
        )

    # Build update data (exclude unset fields)
    update_data = category_update.dict(exclude_unset=True)

    # Check name uniqueness if name is being updated
    old_name = category.get("name")
    if "name" in update_data and update_data["name"] != old_name:
        existing = collection.find_one({
            "name": {"$regex": f"^{re.escape(update_data['name'])}$", "$options": "i"},
            "is_deleted": {"$ne": True},
            "_id": {"$ne": ObjectId(category_id)}
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with name '{update_data['name']}' already exists"
            )
            
        # P1-15: Propagate name change to related books (stored in genre field)
        db.books.update_many(
            {"genre": old_name},
            {"$set": {"genre": update_data["name"]}}
        )

    # Add updated_at timestamp
    update_data["updated_at"] = datetime.utcnow()

    # Update in MongoDB
    result = collection.update_one(
        {"_id": ObjectId(category_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found"
        )

    # Get updated category
    updated = collection.find_one({"_id": ObjectId(category_id)})
    logger.info(f"✅ Category updated: {category_id}")
    return serialize_category(updated)


# ============================================
# 6. SOFT DELETE CATEGORY (Admin Only)
# ============================================
@router.delete("/{category_id}")
async def delete_category(
    category_id: str,
    db=Depends(get_db),
    current_user=Depends(has_permission("categories:delete"))
):
    """
    Soft delete a category.
    - Checks if any books reference this category_id before deletion.
    - Sets is_deleted=True instead of removing from the database.
    """
    collection = db.categories

    # Validate ObjectId
    if not ObjectId.is_valid(category_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category ID format"
        )

    # Check if category exists and is not already soft-deleted
    category = collection.find_one({
        "_id": ObjectId(category_id),
        "is_deleted": {"$ne": True}
    })
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found"
        )

    # Safe delete: check if any books reference this category
    books_collection = db.books
    books_with_category = books_collection.count_documents({
        "genre": category.get("name")
    })
    if books_with_category > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete category '{category.get('name')}'. {books_with_category} book(s) are still associated with this category. Please reassign or remove books first."
        )

    # Insert into recycle bin
    db.recycle_bin.insert_one({
        "original_collection": "categories",
        "record": category,
        "deleted_at": datetime.utcnow(),
        "deleted_by": current_user.get("username", "admin"),
        "display_name": category.get("name", "Unknown Category")
    })

    # Hard delete from categories collection
    collection.delete_one({"_id": ObjectId(category_id)})

    logger.info(f"🗑️ Category moved to recycle bin: {category.get('name')} (ID: {category_id})")
    return {
        "message": f"Category '{category.get('name')}' has been deleted successfully",
        "id": category_id
    }

