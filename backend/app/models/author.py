from datetime import datetime, timezone


def author_document(data: dict) -> dict:
    """Create MongoDB document from author data"""
    return {
        "name": data.get("name"),
        "biography": data.get("biography", ""),
        "birth_date": data.get("birth_date", ""),
        "nationality": data.get("nationality", ""),
        "status": data.get("status", "active"),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
        "updated_at": datetime.now(timezone.utc).replace(tzinfo=None)
    }


def serialize_author(author: dict) -> dict:
    """Convert MongoDB document to dict with string id"""
    if author:
        if "_id" in author:
            author["id"] = str(author["_id"])
            del author["_id"]
        author.setdefault("created_at", datetime.now(timezone.utc).replace(tzinfo=None))
        author.setdefault("updated_at", datetime.now(timezone.utc).replace(tzinfo=None))
    return author


def serialize_authors(authors: list) -> list:
    """Convert list of MongoDB documents"""
    return [serialize_author(author) for author in authors]
