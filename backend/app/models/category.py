from datetime import datetime, timezone


def category_document(data: dict) -> dict:
    """Create MongoDB document from category data"""
    return {
        "name": data.get("name"),
        "description": data.get("description", ""),
        "status": data.get("status", "active"),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
        "updated_at": datetime.now(timezone.utc).replace(tzinfo=None)
    }


def serialize_category(category: dict) -> dict:
    """Convert MongoDB document to dict with string id"""
    if category:
        if "_id" in category:
            category["id"] = str(category["_id"])
            del category["_id"]
        category.setdefault("created_at", datetime.now(timezone.utc).replace(tzinfo=None))
        category.setdefault("updated_at", datetime.now(timezone.utc).replace(tzinfo=None))
    return category


def serialize_categories(categories: list) -> list:
    """Convert list of MongoDB documents"""
    return [serialize_category(category) for category in categories]
