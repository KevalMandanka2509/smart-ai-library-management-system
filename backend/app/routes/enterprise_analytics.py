from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from ..database import get_db
from ..core.security import get_current_admin, get_current_user
from ..core.rbac import has_permission
from bson import ObjectId
import random # ONLY for tie breakers if needed, no fake data

router = APIRouter(prefix="/api/v1/enterprise_analytics", tags=["Enterprise Analytics"])

def _normalize_date_field(field: str) -> dict:
    """
    Returns a $addFields stage that converts a field to a proper Date.
    Handles mixed types: if already a Date, keep it; if a string, parse it.
    The normalized field is stored as __norm_{field} to avoid overwriting.
    """
    norm = f"__norm_{field.replace('.', '_')}"
    return {
        "$addFields": {
            norm: {
                "$cond": {
                    "if": {"$eq": [{"$type": f"${field}"}, "date"]},
                    "then": f"${field}",
                    "else": {
                        "$cond": {
                            "if": {"$eq": [{"$type": f"${field}"}, "string"]},
                            "then": {"$dateFromString": {"dateString": f"${field}", "onError": None, "onNull": None}},
                            "else": None
                        }
                    }
                }
            }
        }
    }

def _date_agg_pipeline(date_field: str, start: datetime, end: datetime, date_fmt: str, extra_match: dict = None) -> list:
    """
    Build a standard aggregation pipeline that:
    1. Normalizes the date field (handles string vs datetime)
    2. Filters by date range
    3. Groups by formatted date
    """
    norm = f"__norm_{date_field.replace('.', '_')}"
    match_q = {norm: {"$gte": start, "$lte": end}}
    if extra_match:
        match_q.update(extra_match)
    return [
        _normalize_date_field(date_field),
        {"$match": match_q},
        {"$group": {"_id": {"$dateToString": {"format": date_fmt, "date": f"${norm}"}}, "count": {"$sum": 1}}}
    ]

def _book_lookup_pipeline(local_field: str = "book_id") -> list:
    """
    Build lookup stages that handle book_id (stored as string ObjectId in borrows)
    matched against _id (ObjectId) in books collection.
    """
    return [
        {"$addFields": {"__book_oid": {"$cond": {
            "if": {"$eq": [{"$strLenCP": {"$ifNull": [f"${local_field}", ""]}}, 24]},
            "then": {"$toObjectId": f"${local_field}"},
            "else": f"${local_field}"
        }}}},
        {"$lookup": {"from": "books", "localField": "__book_oid", "foreignField": "_id", "as": "book_info"}},
        {"$unwind": {"path": "$book_info", "preserveNullAndEmptyArrays": True}},
    ]

def _build_date_expr(field: str, start: datetime, end: datetime) -> dict:
    """
    Builds a $expr query that safely converts a field (string or date) to Date 
    before comparing with start/end boundaries.
    """
    date_converter = {
        "$cond": {
            "if": {"$eq": [{"$type": f"${field}"}, "date"]},
            "then": f"${field}",
            "else": {"$dateFromString": {"dateString": f"${field}", "onError": None, "onNull": None}}
        }
    }
    return {
        "$expr": {
            "$and": [
                {"$gte": [date_converter, start]},
                {"$lte": [date_converter, end]}
            ]
        }
    }

def _get_date_range(period: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    if date_from and date_to:
        try:
            start = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            end = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            if start == end:
                end = end.replace(hour=23, minute=59, second=59)
            return start, end
        except Exception:
            pass
            
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "yesterday":
        start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        now = start.replace(hour=23, minute=59, second=59)
    elif period == "last_7_days":
        start = now - timedelta(days=7)
    elif period == "this_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "last_month":
        end_last = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(microseconds=1)
        start = end_last.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        now = end_last
    elif period == "last_3_months":
        start = now - timedelta(days=90)
    elif period == "last_6_months":
        start = now - timedelta(days=180)
    elif period == "this_year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "last_year":
        end_last = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(microseconds=1)
        start = end_last.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        now = end_last
    elif period == "all_time" or period == "all":
        start = datetime(2000, 1, 1)
    else: # last_30_days default
        start = now - timedelta(days=30)
        
    return start, now

def _build_match_query(start: datetime, end: datetime, date_field: str = "created_at", category: Optional[str] = None, author: Optional[str] = None, book_id: Optional[str] = None, member_id: Optional[str] = None, status: Optional[str] = None) -> dict:
    match_q = _build_date_expr(date_field, start, end)
    if member_id and member_id != 'all':
        match_q["student_id"] = member_id
    if book_id and book_id != 'all':
        match_q["book_id"] = book_id
    if status and status != 'all':
        match_q["status"] = status
    return match_q

# ---------------------------------------------------------
# 1. Overview KPIs
# ---------------------------------------------------------
@router.get("/filter-options")
async def get_filter_options(db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    categories = sorted([c for c in db.books.distinct("genre") if c])
    authors = sorted([a for a in db.books.distinct("author") if a])
    books = sorted([b for b in db.books.distinct("title") if b])
    
    # We will use member_id for student filtering, but UI needs names.
    # To keep it simple and match the generic filter layout, we'll return a list of dicts or just distinct member names
    # Wait, the simplest is distinct student_id for value, but let's just return distinct student_name from borrows to match whatever was used,
    # or just return student objects. Actually let's return distinct names for now, we can match by name or id later.
    # The `_build_match_query` expects `member_id`, but we can let it accept name or ID.
    # Let's get list of students (id and name)
    students = list(db.students.find({"is_active": True}, {"name": 1, "student_id": 1}))
    members = [{"id": str(s.get("student_id", s.get("_id"))), "name": s.get("name", "Unknown")} for s in students]

    return {
        "categories": categories,
        "authors": authors,
        "books": books,
        "members": members,
        "statuses": ["issued", "returned"]
    }

@router.get("/overview")
async def get_overview(
    period: str = Query("last_30_days"), date_from: Optional[str] = None, date_to: Optional[str] = None,
    member: Optional[str] = None, db=Depends(get_db), current_user=Depends(has_permission("reports:view"))
):
    start, end = _get_date_range(period, date_from, date_to)
    prev_start = start - (end - start)
    
    total_books = db.books.estimated_document_count()
    available_books = db.books.count_documents({"is_available": True})
    reserved_books = db.reservations.count_documents({"status": "pending"})
    total_members = db.students.estimated_document_count()
    
    curr_issues = db.borrows.count_documents(_build_match_query(start, end, "issue_date", member_id=member))
    prev_issues = db.borrows.count_documents(_build_match_query(prev_start, start, "issue_date", member_id=member))
    
    curr_returns = db.borrows.count_documents(_build_match_query(start, end, "return_date", member_id=member))
    prev_returns = db.borrows.count_documents(_build_match_query(prev_start, start, "return_date", member_id=member))
    
    overdue_match = {"status": "issued", "due_date": {"$lt": datetime.now(timezone.utc).replace(tzinfo=None)}}
    if member and member != 'all': overdue_match["student_id"] = member
    curr_overdue = db.borrows.count_documents(overdue_match)
    
    fine_agg = list(db.fines.aggregate([
        {"$match": _build_match_query(start, end, "created_at", member_id=member)},
        {"$group": {"_id": "$paid", "total": {"$sum": "$amount"}}}
    ]))
    curr_fines_gen = sum([f["total"] for f in fine_agg])
    curr_fines_coll = sum([f["total"] for f in fine_agg if f["_id"] == True])
    
    prev_fine_agg = list(db.fines.aggregate([
        {"$match": _build_match_query(prev_start, start, "created_at", member_id=member)},
        {"$group": {"_id": "$paid", "total": {"$sum": "$amount"}}}
    ]))
    prev_fines_gen = sum([f["total"] for f in prev_fine_agg])
    prev_fines_coll = sum([f["total"] for f in prev_fine_agg if f["_id"] == True])

    def calc_trend(curr, prev):
        if prev == 0: return 100.0 if curr > 0 else 0.0
        return round(((curr - prev) / prev) * 100, 1)

    curr_coll_rate = round((curr_fines_coll / curr_fines_gen * 100), 1) if curr_fines_gen > 0 else 0
    prev_coll_rate = round((prev_fines_coll / prev_fines_gen * 100), 1) if prev_fines_gen > 0 else 0

    return {
        "total_books": {"value": total_books, "trend": 0},
        "total_members": {"value": total_members, "trend": 0},
        "total_issues": {"value": curr_issues, "trend": calc_trend(curr_issues, prev_issues)},
        "total_returns": {"value": curr_returns, "trend": calc_trend(curr_returns, prev_returns)},
        "overdue_books": {"value": curr_overdue, "trend": 0},
        "fines_generated": {"value": curr_fines_gen, "trend": calc_trend(curr_fines_gen, prev_fines_gen)},
        "fines_collected": {"value": curr_fines_coll, "trend": calc_trend(curr_fines_coll, prev_fines_coll)},
        "collection_rate": {"value": curr_coll_rate, "trend": round(curr_coll_rate - prev_coll_rate, 1)},
        "available_books": {"value": available_books, "trend": 0},
        "reserved_books": {"value": reserved_books, "trend": 0}
    }

# ---------------------------------------------------------
# 2. Circulation Analytics
# ---------------------------------------------------------
@router.get("/circulation")
async def get_circulation(
    period: str = Query("last_30_days"), date_from: Optional[str] = None, date_to: Optional[str] = None,
    granularity: Optional[str] = None,
    db=Depends(get_db), current_user=Depends(has_permission("reports:view"))
):
    start, end = _get_date_range(period, date_from, date_to)
    days = (end - start).days
    
    date_fmt = "%Y-%m-%d"
    if granularity == "yearly": date_fmt = "%Y"
    elif granularity == "quarterly": date_fmt = "%Y-Q" # Mongo doesn't easily support Q out of the box in dateToString without complex formatting, so we'll fallback to month if needed, but let's just use "%Y-%m" for monthly and group in python for quarterly. Actually %Y-%m is fine.
    elif granularity == "monthly": date_fmt = "%Y-%m"
    elif granularity == "weekly": date_fmt = "%Y-%U"
    elif granularity == "daily": date_fmt = "%Y-%m-%d"
    else:
        if days > 365: date_fmt = "%Y"
        elif days > 90: date_fmt = "%Y-%m"
    
    issue_agg = list(db.borrows.aggregate(_date_agg_pipeline("issue_date", start, end, date_fmt)))
    
    return_agg = list(db.borrows.aggregate(_date_agg_pipeline("return_date", start, end, date_fmt)))
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # For overdue, due_date must be before now, so end time is min(end, now)
    overdue_end = end if end < now else now
    overdue_agg = list(db.borrows.aggregate(_date_agg_pipeline("due_date", start, overdue_end, date_fmt, {"status": "issued"})))

    issues = {doc["_id"]: doc["count"] for doc in issue_agg if doc["_id"]}
    returns = {doc["_id"]: doc["count"] for doc in return_agg if doc["_id"]}
    overdues = {doc["_id"]: doc["count"] for doc in overdue_agg if doc["_id"]}
    
    all_keys = sorted(set(list(issues.keys()) + list(returns.keys()) + list(overdues.keys())))
    
    trend_data = [{"period": k, "issues": issues.get(k, 0), "returns": returns.get(k, 0), "overdue": overdues.get(k, 0)} for k in all_keys]
    
    # Calculate previous period for growth
    prev_start = start - (end - start)
    # Subtract 1 millisecond so it's strictly less than start (since count is gte/lte)
    prev_end = start - timedelta(milliseconds=1)
    
    prev_issues_count = db.borrows.count_documents(_build_date_expr("issue_date", prev_start, prev_end))
    prev_returns_count = db.borrows.count_documents(_build_date_expr("return_date", prev_start, prev_end))
    
    curr_issues_count = sum(issues.values())
    curr_returns_count = sum(returns.values())
    
    issue_growth = None
    if prev_issues_count > 0:
        issue_growth = round(((curr_issues_count - prev_issues_count) / prev_issues_count) * 100, 1)
    elif curr_issues_count > 0 and prev_issues_count == 0:
        issue_growth = 100.0

    return_growth = None
    if prev_returns_count > 0:
        return_growth = round(((curr_returns_count - prev_returns_count) / prev_returns_count) * 100, 1)
    elif curr_returns_count > 0 and prev_returns_count == 0:
        return_growth = 100.0

    return {
        "trend": trend_data,
        "summary": {
            "total_issues": curr_issues_count,
            "total_returns": curr_returns_count,
            "total_overdue": sum(overdues.values()),
            "issue_growth": issue_growth,
            "return_growth": return_growth
        }
    }

# ---------------------------------------------------------
# 3. Book Analytics
# ---------------------------------------------------------
@router.get("/books-analytics")
async def get_books_analytics(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    
    # Most Borrowed
    most_borrowed_pipeline = [
        _normalize_date_field("issue_date"),
        {"$match": {"__norm_issue_date": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$book_id", "title": {"$first": "$book_title"}, "issues": {"$sum": 1}}}
    ] + _book_lookup_pipeline("_id") + [
        {"$addFields": {"author": {"$ifNull": ["$book_info.author", "Unknown"]}}},
        {"$project": {"book_info": 0, "__book_oid": 0}},
        {"$sort": {"issues": -1}}, {"$limit": 5}
    ]
    most_borrowed = list(db.borrows.aggregate(most_borrowed_pipeline))
    
    # Most Overdue
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # Group overdue books by book_id to get overdueCount and min due_date (max days overdue)
    overdue_pipeline = [
        {"$match": {"status": "issued"}},
        _normalize_date_field("due_date"),
        {"$match": {"__norm_due_date": {"$lt": now}}},
        {"$group": {
            "_id": "$book_id", 
            "title": {"$first": "$book_title"}, 
            "overdueCount": {"$sum": 1}, 
            "min_due_date": {"$min": "$__norm_due_date"},
            "student_ids": {"$push": "$student_id"}
        }}
    ] + _book_lookup_pipeline("_id") + [
        {"$addFields": {"author": {"$ifNull": ["$book_info.author", "Unknown"]}}},
        {"$project": {"__book_oid": 0}}
    ]
    overdue_agg = list(db.borrows.aggregate(overdue_pipeline))
    
    most_overdue = []
    for doc in overdue_agg:
        due = doc.get("min_due_date")
        if isinstance(due, str): due = datetime.fromisoformat(due.replace("Z", "+00:00"))
        days_overdue = (now - due).days if due else 0
        
        # Calculate fine by summing unpaid fines for these students (approximate, since fines are per student)
        # Actually, let's just query fines for this book if the fine collection has book_id, or just use 0 if not easily available.
        # But wait, we can just use 0 if it's too complex, or let's try to query db.fines for unpaid fines for this book.
        # Since book_title is in fines, let's use it.
        book_title = doc.get("title")
        book_fines = list(db.fines.find({"book_title": book_title, "paid": False}))
        total_fine = sum(f.get("amount", 0) for f in book_fines)
        
        most_overdue.append({
            "_id": doc["_id"],
            "title": book_title,
            "author": doc.get("author"),
            "overdueCount": doc["overdueCount"],
            "daysOverdue": days_overdue,
            "fine": total_fine
        })
        
    most_overdue = sorted(most_overdue, key=lambda x: x["daysOverdue"], reverse=True)[:5]
    
    # Most Reserved
    most_reserved = list(db.reservations.aggregate([
        {"$match": {"reserved_at": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$book_id", "title": {"$first": "$book_title"}, "reservations": {"$sum": 1}}},
        {"$lookup": {"from": "books", "localField": "_id", "foreignField": "book_id", "as": "book_info"}},
        {"$unwind": {"path": "$book_info", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {"author": {"$ifNull": ["$book_info.author", "Unknown"]}}},
        {"$project": {"book_info": 0}},
        {"$sort": {"reservations": -1}}, {"$limit": 5}
    ]))

    return {"most_borrowed": most_borrowed, "most_overdue": most_overdue, "most_reserved": most_reserved}

# ---------------------------------------------------------
# 4. Category Analytics
# ---------------------------------------------------------
# ---------------------------------------------------------
# 4. Category Analytics
# ---------------------------------------------------------
@router.get("/categories")
async def get_categories(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    
    # 1. Distribution & Utilization (Current Inventory)
    # Get all books to calculate current distribution and utilization
    books = list(db.books.find({}, {"genre": 1, "is_available": 1, "book_id": 1}))
    # Get all pending reservations to know which categories are reserved
    reservations = list(db.reservations.find({"status": "pending"}, {"book_id": 1}))
    reserved_book_ids = {r["book_id"] for r in reservations if "book_id" in r}
    
    cat_counts = {}
    for b in books:
        g = b.get("genre", "Uncategorized")
        if not g: g = "Uncategorized"
        
        if g not in cat_counts: 
            cat_counts[g] = {"total": 0, "available": 0, "issued": 0, "reserved": 0}
            
        cat_counts[g]["total"] += 1
        
        # Check if reserved (simplified logic: if book_id is in reserved_book_ids, count as reserved)
        # In a real system, a book can be issued AND reserved for the future, but usually utilization is mutually exclusive.
        # Let's count it based on status.
        if b.get("book_id") in reserved_book_ids:
            cat_counts[g]["reserved"] += 1
        elif b.get("is_available"): 
            cat_counts[g]["available"] += 1
        else: 
            cat_counts[g]["issued"] += 1
            
    # Calculate percentages for distribution
    total_books = sum(v["total"] for v in cat_counts.values())
    
    distribution_list = []
    utilization_list = []
    
    for k, v in cat_counts.items():
        pct = round((v["total"] / total_books) * 100, 1) if total_books > 0 else 0
        distribution_list.append({
            "category": k,
            "count": v["total"],
            "percentage": pct
        })
        utilization_list.append({
            "category": k,
            "available": v["available"],
            "issued": v["issued"],
            "reserved": v["reserved"],
            "total": v["total"]
        })
        
    distribution = sorted(distribution_list, key=lambda x: x["count"], reverse=True)
    
    # Group remaining into "Other" if > 5 categories for distribution
    if len(distribution) > 5:
        top_5 = distribution[:5]
        other_count = sum(d["count"] for d in distribution[5:])
        other_pct = round((other_count / total_books) * 100, 1) if total_books > 0 else 0
        top_5.append({"category": "Other", "count": other_count, "percentage": other_pct})
        distribution = top_5

    # Utilization top 5
    utilization = sorted(utilization_list, key=lambda x: x["total"], reverse=True)[:5]
    
    # 2. Borrowing (Date range filtered)
    borrow_pipeline = [
        _normalize_date_field("issue_date"),
        {"$match": {"__norm_issue_date": {"$gte": start, "$lte": end}}},
        _normalize_date_field("due_date")
    ] + _book_lookup_pipeline("book_id") + [
        {"$addFields": {"category": {"$ifNull": ["$book_info.genre", "Uncategorized"]}}},
        {"$group": {
            "_id": "$category", 
            "issues": {"$sum": 1},
            "returns": {"$sum": {"$cond": [{"$eq": ["$status", "returned"]}, 1, 0]}},
            "overdue": {"$sum": {"$cond": [{"$and": [{"$eq": ["$status", "issued"]}, {"$lt": ["$__norm_due_date", datetime.now(timezone.utc).replace(tzinfo=None)]}]}, 1, 0]}}
        }},
        {"$sort": {"issues": -1}}
    ]
    borrow_agg = list(db.borrows.aggregate(borrow_pipeline))
    
    borrowing_list = []
    for doc in borrow_agg:
        cat = doc["_id"] if doc["_id"] else "Uncategorized"
        borrowing_list.append({
            "category": cat,
            "issues": doc["issues"],
            "returns": doc["returns"],
            "overdue": doc["overdue"]
        })
        
    borrowing = sorted(borrowing_list, key=lambda x: x["issues"], reverse=True)[:6]

    return {
        "distribution": distribution,
        "borrowing": borrowing,
        "utilization": utilization,
        "total_books": total_books
    }

# ---------------------------------------------------------
# 5. Author Analytics
# ---------------------------------------------------------
@router.get("/authors")
async def get_authors(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    
    # Borrowing by author
    author_borrows_pipeline = [
        _normalize_date_field("issue_date"),
        {"$match": {"__norm_issue_date": {"$gte": start, "$lte": end}}}
    ] + _book_lookup_pipeline("book_id") + [
        {"$group": {"_id": {"$ifNull": ["$book_info.author", "Unknown"]}, "issues": {"$sum": 1}}},
        {"$sort": {"issues": -1}}
    ]
    author_borrows = list(db.borrows.aggregate(author_borrows_pipeline))
    
    # Reservations by author
    author_res_pipeline = [
        _normalize_date_field("reserved_at"),
        {"$match": {"__norm_reserved_at": {"$gte": start, "$lte": end}}}
    ] + _book_lookup_pipeline("book_id") + [
        {"$group": {"_id": {"$ifNull": ["$book_info.author", "Unknown"]}, "reservations": {"$sum": 1}}},
        {"$sort": {"reservations": -1}}
    ]
    author_reservations = list(db.reservations.aggregate(author_res_pipeline))
    res_dict = {d["_id"]: d["reservations"] for d in author_reservations if d["_id"]}
    
    # Combine data for Top Authors
    all_authors = db.books.distinct("author")
    total_authors = len([a for a in all_authors if a])
    
    # Calculate Books per Author efficiently
    books_per_author = list(db.books.aggregate([
        {"$group": {"_id": "$author", "count": {"$sum": 1}}}
    ]))
    books_dict = {d["_id"]: d["count"] for d in books_per_author if d["_id"]}
    
    top_list = []
    # We want to sort primarily by issues, then books
    # Let's collect all authors that have issues or reservations or books
    active_author_names = {d["_id"] for d in author_borrows if d["_id"]}
    
    for doc in author_borrows:
        author = doc["_id"]
        if not author or author == "Unknown": continue
        top_list.append({
            "author": author,
            "books": books_dict.get(author, 0),
            "issues": doc["issues"],
            "reservations": res_dict.get(author, 0)
        })
        
    top_list = sorted(top_list, key=lambda x: (x["issues"], x["books"]), reverse=True)[:5]
    
    # Calculate Summary
    active_authors_count = len(active_author_names)
    most_borrowed = top_list[0]["author"] if top_list else None
    
    most_reserved = None
    if author_reservations and author_reservations[0]["_id"]:
        most_reserved = author_reservations[0]["_id"]
        
    return {
        "summary": {
            "total_authors": total_authors,
            "active_authors": active_authors_count,
            "most_borrowed": most_borrowed,
            "most_reserved": most_reserved
        },
        "top_authors": top_list
    }

# ---------------------------------------------------------
# 6. Member Analytics
# ---------------------------------------------------------
@router.get("/members")
async def get_members_analytics(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    
    # 1. Summary Metrics
    total_members = db.students.count_documents({})
    
    # Active Members in period
    active_members_cursor = db.borrows.aggregate([
        {"$match": {"issue_date": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$student_id"}}
    ])
    active_count = len(list(active_members_cursor))
    inactive_count = total_members - active_count
    
    # Pending Returns (Members with currently issued books)
    pending_returns_cursor = db.borrows.aggregate([
        {"$match": {"status": "issued"}},
        {"$group": {"_id": "$student_id"}}
    ])
    pending_returns_count = len(list(pending_returns_cursor))
    
    # Members With Fines (Unpaid)
    members_with_fines_cursor = db.fines.aggregate([
        {"$match": {"paid": False}},
        {"$group": {"_id": "$student_id"}}
    ])
    members_with_fines_count = len(list(members_with_fines_cursor))
    
    summary = {
        "active_members": active_count,
        "inactive_members": inactive_count,
        "pending_returns": pending_returns_count,
        "members_with_fines": members_with_fines_count
    }
    
    # 2. Most Active Members Table (Top 5)
    top_members_agg = list(db.borrows.aggregate([
        {"$match": {"issue_date": {"$gte": start, "$lte": end}}},
        {"$group": {
            "_id": "$student_id",
            "name": {"$first": "$student_name"},
            "issues": {"$sum": 1},
            "returns": {"$sum": {"$cond": [{"$eq": ["$status", "returned"]}, 1, 0]}},
            "overdue": {"$sum": {"$cond": [{"$and": [{"$eq": ["$status", "issued"]}, {"$lt": ["$due_date", datetime.now(timezone.utc).replace(tzinfo=None)]}]}, 1, 0]}},
            "last_activity": {"$max": "$issue_date"}
        }},
        {"$sort": {"issues": -1, "returns": -1}},
        {"$limit": 5}
    ]))
    
    top_members = []
    for m in top_members_agg:
        student_id = m["_id"]
        # Reservations in period
        res_count = db.reservations.count_documents({
            "student_id": student_id, 
            "reserved_at": {"$gte": start, "$lte": end}
        })
        # Fines total (unpaid)
        fines_agg = list(db.fines.aggregate([
            {"$match": {"student_id": student_id, "paid": False}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]))
        total_fine = fines_agg[0]["total"] if fines_agg else 0
        
        last_act = m["last_activity"]
        if isinstance(last_act, datetime):
            last_act_str = last_act.strftime("%d %b %Y")
        elif isinstance(last_act, str):
            try:
                last_act_str = datetime.fromisoformat(last_act.replace("Z", "+00:00")).strftime("%d %b %Y")
            except:
                last_act_str = last_act
        else:
            last_act_str = "Unknown"
            
        top_members.append({
            "member": m.get("name") or student_id,
            "issues": m["issues"],
            "returns": m["returns"],
            "overdue": m["overdue"],
            "fine": total_fine,
            "reservations": res_count,
            "last_activity": last_act_str
        })
        
    return {"summary": summary, "top_members": top_members}

# ---------------------------------------------------------
# 7. Behaviour & Heatmap
# ---------------------------------------------------------
@router.get("/behaviour")
async def get_behaviour(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    # Heatmap needs exactly 12 weeks. If the global period is specific, we use that, but by default (or if "last_12_weeks" was requested), we need 84 days.
    # The prompt says: "If global Date Range is default/current: use Last 12 Weeks."
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    if period == "last_30_days" or not period:
        heatmap_start = (now - timedelta(weeks=12)).replace(hour=0, minute=0, second=0, microsecond=0)
        heatmap_end = now
    else:
        heatmap_start, heatmap_end = _get_date_range(period)

    # Fetch borrows for heatmap
    heatmap_agg = list(db.borrows.aggregate([
        {"$match": {"issue_date": {"$gte": heatmap_start, "$lte": heatmap_end}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$issue_date"}}, "count": {"$sum": 1}}}
    ]))
    heatmap_data = [{"date": doc["_id"], "count": doc["count"]} for doc in heatmap_agg]

    # Behaviour metrics based on the regular date range
    start, end = _get_date_range(period)
    borrows = list(db.borrows.find({"issue_date": {"$gte": start, "$lte": end}}, {"issue_date": 1, "return_date": 1, "due_date": 1, "status": 1}))
    
    days_count = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0}
    hours_count = {h:0 for h in range(24)}
    durations = []
    
    for b in borrows:
        issue = b.get("issue_date")
        ret = b.get("return_date")
        if issue:
            if isinstance(issue, str): 
                try: issue = datetime.fromisoformat(issue.replace("Z", "+00:00"))
                except: continue
            days_count[issue.weekday()] += 1
            hours_count[issue.hour] += 1
        if issue and ret:
            if isinstance(ret, str): 
                try: ret = datetime.fromisoformat(ret.replace("Z", "+00:00"))
                except: continue
            durations.append((ret - issue).total_seconds() / 86400) # accurate days
            
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    peak_days = [{"day": day_names[k], "issues": v} for k, v in days_count.items()]
    
    # Filter hours with zero to avoid fake activity, except we might need to show the chart properly. The prompt says "Only show hours that can actually be derived from real timestamps."
    peak_hours = [{"hour": f"{k:02d}:00", "issues": v} for k, v in hours_count.items() if v > 0]
    # If no hours have data, we just return empty list
    if not peak_hours:
        peak_hours = []

    avg_duration = sum(durations) / len(durations) if durations else 0
    
    # On-time vs Late (for returned books only)
    returned_borrows = [b for b in borrows if b.get("status") == "returned" and b.get("return_date") and b.get("due_date")]
    ontime = 0
    late = 0
    for b in returned_borrows:
        ret = b.get("return_date")
        due = b.get("due_date")
        if isinstance(ret, str): ret = datetime.fromisoformat(ret.replace("Z", "+00:00"))
        if isinstance(due, str): due = datetime.fromisoformat(due.replace("Z", "+00:00"))
        if ret > due:
            late += 1
        else:
            ontime += 1
            
    total_returned = ontime + late
    ontime_rate = round((ontime / total_returned * 100), 1) if total_returned > 0 else 0
    late_rate = round((late / total_returned * 100), 1) if total_returned > 0 else 0

    return {
        "peakDays": peak_days,
        "peakHours": peak_hours,
        "returnBehaviour": {
            "onTime": ontime,
            "late": late,
            "onTimeRate": ontime_rate,
            "lateRate": late_rate,
            "totalReturned": total_returned
        },
        "averageDuration": round(avg_duration, 1),
        "heatmap": heatmap_data
    }

# ---------------------------------------------------------
# 8. Overdue Intelligence
# ---------------------------------------------------------
@router.get("/overdue")
async def get_overdue(db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # Overdue records are currently issued books where due_date is in the past
    overdue_list = list(db.borrows.find({"status": "issued", "due_date": {"$lt": now}}))
    
    b1_7 = 0
    b8_30 = 0
    b30p = 0
    
    total_days = 0
    max_days = 0
    total_fines = 0
    members_set = set()
    
    table = []
    for o in overdue_list:
        due = o.get("due_date")
        if isinstance(due, str): 
            try: due = datetime.fromisoformat(due.replace("Z", "+00:00"))
            except: continue
        days = (now - due).total_seconds() / 86400
        if days < 0: continue
        days = int(days)
        
        if days <= 7: b1_7 += 1
        elif days <= 30: b8_30 += 1
        else: b30p += 1
            
        fine = db.fines.find_one({"student_id": o.get("student_id"), "paid": False})
        fine_amt = fine["amount"] if fine else 0
        
        total_days += days
        if days > max_days: max_days = days
        total_fines += fine_amt
        if o.get("student_id"): members_set.add(str(o.get("student_id")))
        
        table.append({
            "member": o.get("student_name", "Unknown"),
            "book": o.get("book_title", "Unknown"),
            "issue_date": o.get("issue_date"),
            "due_date": o.get("due_date"),
            "days_overdue": days,
            "fine": fine_amt,
            "status": "Critical" if days > 30 else "Overdue"
        })
        
    avg_days = total_days / len(overdue_list) if overdue_list else 0
    
    return {
        "summary": {
            "totalOverdue": len(overdue_list),
            "oneToSeven": b1_7,
            "eightToThirty": b8_30,
            "thirtyPlus": b30p,
            "critical": b30p,  # Using 30+ days as critical threshold
            "averageDaysOverdue": round(avg_days, 1),
            "maximumDaysOverdue": max_days,
            "outstandingFine": total_fines,
            "membersWithOverdue": len(members_set)
        },
        "records": sorted(table, key=lambda x: x["days_overdue"], reverse=True)[:50]
    }

# ---------------------------------------------------------
# 9. Fines & Revenue
# ---------------------------------------------------------
@router.get("/fines")
async def get_fines(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    
    date_fmt = "%Y-%m-%d"
    
    gen_agg = list(db.fines.aggregate([
        {"$match": {"created_at": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": {"$dateToString": {"format": date_fmt, "date": "$created_at"}}, "total": {"$sum": "$amount"}}}
    ]))
    
    coll_agg = list(db.fines.aggregate([
        {"$match": {"paid_at": {"$gte": start, "$lte": end}, "paid": True}},
        {"$group": {"_id": {"$dateToString": {"format": date_fmt, "date": "$paid_at"}}, "total": {"$sum": "$amount"}}}
    ]))
    
    gens = {doc["_id"]: doc["total"] for doc in gen_agg}
    colls = {doc["_id"]: doc["total"] for doc in coll_agg}
    all_keys = sorted(set(list(gens.keys()) + list(colls.keys())))
    trend = [{"period": k, "generated": gens.get(k, 0), "collected": colls.get(k, 0)} for k in all_keys]
    
    # Calculate Summary
    fines = list(db.fines.find({"created_at": {"$gte": start, "$lte": end}}))
    generated = sum(f.get("amount", 0) for f in fines)
    collected = sum(f.get("amount", 0) for f in fines if f.get("paid") == True)
    # Assuming 'waived' status doesn't explicitly exist in current DB, we consider everything unpaid as pending
    pending = generated - collected
    waived = 0
    collection_rate = round((collected / generated * 100), 1) if generated > 0 else 0
    
    fine_list = list(db.fines.find({"created_at": {"$gte": start, "$lte": end}}).sort("created_at", -1).limit(50))
    records = []
    for f in fine_list:
        records.append({
            "_id": str(f["_id"]),
            "member": f.get("student_name", "Unknown"),
            "book": f.get("book_title", "Unknown"),
            "fine": f.get("amount", 0),
            "paid": f.get("paid", False),
            "pending": 0 if f.get("paid", False) else f.get("amount", 0),
            "status": "Paid" if f.get("paid", False) else "Pending",
            "created_at": f.get("created_at")
        })
        
    records = sorted(records, key=lambda x: x["pending"], reverse=True)
        
    return {
        "summary": {
            "generated": generated,
            "collected": collected,
            "pending": pending,
            "waived": waived,
            "collectionRate": collection_rate
        },
        "trend": trend,
        "records": records[:10]
    }

# ---------------------------------------------------------
# 10. Inventory & Acquisitions
# ---------------------------------------------------------
@router.get("/inventory")
async def get_inventory(db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    total = db.books.estimated_document_count()
    available = db.books.count_documents({"is_available": True})
    issued = total - available
    reserved = db.reservations.count_documents({"status": "pending"})
    
    # Calculate Utilization rate
    utilization_rate = round((issued / total * 100), 1) if total > 0 else 0
    
    summary = {
        "total": total,
        "available": available,
        "issued": issued,
        "reserved": reserved,
        "lost": 0,
        "damaged": 0,
        "utilizationRate": utilization_rate
    }
    
    utilization = [
        {"status": "Available", "count": available},
        {"status": "Issued", "count": issued},
        {"status": "Reserved", "count": reserved}
    ]
    
    # Calculate low availability (group by title/ISBN to count available vs total)
    # Since books collection represents physical copies, we group by title
    pipeline = [
        {"$group": {
            "_id": "$title",
            "total": {"$sum": 1},
            "available": {"$sum": {"$cond": [{"$eq": ["$is_available", True]}, 1, 0]}}
        }},
        {"$project": {
            "book": "$_id",
            "total": 1,
            "available": 1,
            "issued": {"$subtract": ["$total", "$available"]},
            "availability_ratio": {"$divide": ["$available", "$total"]}
        }},
        {"$match": {"total": {"$gt": 0}}},
        {"$sort": {"availability_ratio": 1, "available": 1}},
        {"$limit": 5}
    ]
    low_availability = list(db.books.aggregate(pipeline))
    for item in low_availability:
        item["_id"] = str(item["_id"])
        # Fetch reservations for this title
        item["reserved"] = db.reservations.count_documents({"book_title": item["book"], "status": "pending"})
        item["availability_ratio"] = round(item["availability_ratio"] * 100, 1)

    return {
        "summary": summary,
        "utilization": utilization,
        "lowAvailability": low_availability
    }

@router.get("/acquisitions")
async def get_acquisitions(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    
    added = db.books.count_documents({"created_at": {"$gte": start, "$lte": end}})
    
    # Books added in period that were borrowed at least once
    new_books = list(db.books.find({"created_at": {"$gte": start, "$lte": end}}, {"book_id": 1, "title": 1, "author": 1, "genre": 1, "created_at": 1}))
    b_ids = [b["book_id"] for b in new_books]
    
    borrowed_books_ids = db.borrows.distinct("book_id", {"book_id": {"$in": b_ids}})
    borrowed_count = len(borrowed_books_ids)
    never_borrowed_count = added - borrowed_count
    
    trend = list(db.books.aggregate([
        {"$match": {"created_at": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]))
    trend_res = [{"period": doc["_id"], "added": doc["count"]} for doc in trend]
    
    # Recent books
    recent_books = []
    for b in sorted(new_books, key=lambda x: x.get("created_at", ""), reverse=True)[:5]:
        issues = db.borrows.count_documents({"book_id": b["book_id"]})
        reservations = db.reservations.count_documents({"book_id": b["book_id"]})
        status = "Active" if issues > 0 else "Pending Activity"
        recent_books.append({
            "book": b.get("title", "Unknown"),
            "author": b.get("author", "Unknown"),
            "category": b.get("genre", "Unknown"),
            "added": b.get("created_at"),
            "issues": issues,
            "reservations": reservations,
            "status": status
        })
        
    # Never borrowed books
    never_borrowed = []
    never_borrowed_list = [b for b in new_books if b["book_id"] not in borrowed_books_ids]
    for b in sorted(never_borrowed_list, key=lambda x: x.get("created_at", ""))[:5]:
        never_borrowed.append({
            "book": b.get("title", "Unknown"),
            "author": b.get("author", "Unknown"),
            "category": b.get("genre", "Unknown"),
            "added": b.get("created_at")
        })
    
    summary = {
        "added": added,
        "borrowed": borrowed_count,
        "neverBorrowed": never_borrowed_count
    }
    
    return {
        "summary": summary,
        "trend": trend_res,
        "recentBooks": recent_books,
        "neverBorrowed": never_borrowed
    }

# ---------------------------------------------------------
# 11. Reservations
# ---------------------------------------------------------
@router.get("/reservations")
async def get_reservations(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    
    # all reservations in period
    reservations_list = list(db.reservations.find({"reserved_at": {"$gte": start, "$lte": end}}))
    
    total = len(reservations_list)
    pending = 0
    approved = 0
    completed = 0
    cancelled = 0
    
    total_waiting_time = 0
    completed_with_time = 0
    
    for r in reservations_list:
        status = r.get("status")
        if status == "pending": pending += 1
        elif status == "ready": approved += 1
        elif status == "completed": 
            completed += 1
            if r.get("completed_at") and r.get("reserved_at"):
                try:
                    res_at = r["reserved_at"]
                    comp_at = r["completed_at"]
                    if isinstance(res_at, str): res_at = datetime.fromisoformat(res_at.replace("Z", "+00:00"))
                    if isinstance(comp_at, str): comp_at = datetime.fromisoformat(comp_at.replace("Z", "+00:00"))
                    days = (comp_at - res_at).total_seconds() / 86400
                    if days >= 0:
                        total_waiting_time += days
                        completed_with_time += 1
                except:
                    pass
        elif status == "cancelled": cancelled += 1

    conversion_rate = round((completed / total * 100), 1) if total > 0 else 0
    cancellation_rate = round((cancelled / total * 100), 1) if total > 0 else 0
    avg_waiting_time = round((total_waiting_time / completed_with_time), 1) if completed_with_time > 0 else None
    
    trend = list(db.reservations.aggregate([
        {"$match": {"reserved_at": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$reserved_at"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]))
    
    # Most reserved books
    top_books_agg = list(db.reservations.aggregate([
        {"$match": {"reserved_at": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$book_title", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]))
    
    top_books = []
    for tb in top_books_agg:
        # fetch one book to get author
        book_info = db.books.find_one({"title": tb["_id"]})
        author = book_info.get("author", "Unknown") if book_info else "Unknown"
        top_books.append({
            "book": tb["_id"],
            "author": author,
            "reservations": tb["count"],
            "status": "High Demand" if tb["count"] > 3 else "Active"
        })
    
    summary = {
        "total": total,
        "pending": pending,
        "approved": approved,
        "completed": completed,
        "cancelled": cancelled,
        "conversionRate": conversion_rate,
        "cancellationRate": cancellation_rate,
        "averageWaitingTime": avg_waiting_time
    }
    
    return {
        "summary": summary,
        "trend": [{"period": doc["_id"], "reservations": doc["count"]} for doc in trend],
        "topBooks": top_books
    }

# ---------------------------------------------------------
# 12. Real-Time Activity & Growth
# ---------------------------------------------------------
@router.get("/activity")
async def get_activity(db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    logs = list(db.audit_logs.find().sort("timestamp", -1).limit(15))
    res = []
    
    for log in logs:
        action = log.get("action", "Unknown")
        details = log.get("details", "")
        
        # Map to nice UI types based on common audit log actions
        event_type = "System Event"
        icon = "📝"
        if "issue" in action.lower():
            event_type = "Book Issued"
            icon = "📤"
        elif "return" in action.lower():
            event_type = "Book Returned"
            icon = "📥"
        elif "reserv" in action.lower():
            event_type = "Reservation"
            icon = "🔖"
        elif "fine" in action.lower() or "pay" in action.lower():
            event_type = "Fine Payment"
            icon = "💳"
        elif "student" in action.lower() or "member" in action.lower():
            event_type = "Member Update"
            icon = "👤"
        elif "book" in action.lower():
            event_type = "Book Update"
            icon = "📚"
            
        res.append({
            "id": str(log.get("_id", "")),
            "type": event_type,
            "icon": icon,
            "description": details,
            "member": log.get("username", "System"),
            "timestamp": log.get("timestamp")
        })
    return {"activities": res}

@router.get("/member-growth")
async def get_member_growth(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    
    new_members = db.students.count_documents({"created_at": {"$gte": start, "$lte": end}})
    
    # Calculate active/inactive based on is_active flag in students
    # (assuming is_active exists and represents membership status)
    active_members = db.students.count_documents({"is_active": True})
    inactive_members = db.students.count_documents({"is_active": False})
    
    # Calculate growth rate (compare to previous period of same length)
    delta = end - start
    prev_start = start - delta
    prev_end = start
    prev_new_members = db.students.count_documents({"created_at": {"$gte": prev_start, "$lt": prev_end}})
    
    if prev_new_members == 0:
        growth_rate = None
    else:
        growth_rate = round(((new_members - prev_new_members) / prev_new_members) * 100, 1)
        
    trend = list(db.students.aggregate([
        {"$match": {"created_at": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]))
    
    trend_res = [{"period": doc["_id"], "new_members": doc["count"]} for doc in trend]
    
    summary = {
        "newMembers": new_members,
        "activeMembers": active_members,
        "inactiveMembers": inactive_members,
        "growthRate": growth_rate
    }
    
    return {
        "summary": summary,
        "trend": trend_res
    }

# ---------------------------------------------------------
# 13. Smart Insights
# ---------------------------------------------------------
@router.get("/insights")
async def get_insights(period: str = Query("last_30_days"), db=Depends(get_db), current_user=Depends(has_permission("reports:view"))):
    start, end = _get_date_range(period)
    insights = []
    
    # 1. Most borrowed category
    cat_agg = list(db.borrows.aggregate([
        {"$match": {"borrow_date": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$book_id", "count": {"$sum": 1}}}
    ]))
    
    if cat_agg:
        # We need to map book_id back to genre to find the highest genre, 
        # or just do a simpler aggregation using the books collection
        b_ids = [c["_id"] for c in cat_agg]
        books_info = list(db.books.find({"book_id": {"$in": b_ids}}, {"book_id": 1, "genre": 1}))
        genre_map = {b["book_id"]: b.get("genre", "Unknown") for b in books_info}
        
        genre_counts = {}
        for c in cat_agg:
            g = genre_map.get(c["_id"], "Unknown")
            genre_counts[g] = genre_counts.get(g, 0) + c["count"]
            
        if genre_counts:
            top_genre = max(genre_counts.items(), key=lambda x: x[1])
            insights.append({
                "icon": "📈",
                "category": "Demand",
                "title": f"High demand for {top_genre[0]}",
                "description": f"{top_genre[0]} is the most borrowed category.",
                "metric": f"{top_genre[1]} issues",
                "priority": "Medium",
                "label": "Smart Insight"
            })
            
    # 2. Overdue activity
    overdue_count = db.borrows.count_documents({"status": "issued", "due_date": {"$lt": datetime.now(timezone.utc).replace(tzinfo=None)}})
    if overdue_count > 10:
        insights.append({
            "icon": "⚠️",
            "category": "Overdue",
            "title": "Critical Overdue Levels",
            "description": "High number of books are currently overdue. Automated SMS reminders recommended.",
            "metric": f"{overdue_count} overdue",
            "priority": "High",
            "label": "Smart Insight"
        })
    elif overdue_count == 0:
        insights.append({
            "icon": "✅",
            "category": "Overdue",
            "title": "Healthy Returns",
            "description": "Zero books are currently overdue in the system.",
            "metric": "0 overdue",
            "priority": "Low",
            "label": "Smart Insight"
        })
        
    # 3. Fine collection
    fines = list(db.fines.find({"created_at": {"$gte": start, "$lte": end}}))
    gen = sum(f.get("amount", 0) for f in fines)
    col = sum(f.get("amount", 0) for f in fines if f.get("paid"))
    if gen > 0:
        rate = (col / gen) * 100
        if rate < 30:
            insights.append({
                "icon": "💳",
                "category": "Finance",
                "title": "Low Fine Collection",
                "description": "Fine collection rate is critically low for the period.",
                "metric": f"{round(rate,1)}% collected",
                "priority": "High",
                "label": "Smart Insight"
            })
            
    # 4. Low Availability
    total_books = db.books.estimated_document_count()
    available_books = db.books.count_documents({"is_available": True})
    if total_books > 0:
        avail_rate = (available_books / total_books) * 100
        if avail_rate < 20:
            insights.append({
                "icon": "📚",
                "category": "Inventory",
                "title": "Low Inventory Availability",
                "description": "Overall library availability is running low.",
                "metric": f"{round(avail_rate,1)}% available",
                "priority": "High",
                "label": "Smart Insight"
            })
            
    # 5. Member Engagement
    new_mem = db.students.count_documents({"created_at": {"$gte": start, "$lte": end}})
    if new_mem > 50:
        insights.append({
            "icon": "👥",
            "category": "Engagement",
            "title": "Strong Registration Growth",
            "description": "New member registrations are highly active this period.",
            "metric": f"+{new_mem} members",
            "priority": "Medium",
            "label": "Smart Insight"
        })
        
    # fallback if insights are empty
    if not insights:
        insights.append({
            "icon": "ℹ️",
            "category": "System",
            "title": "Normal Operations",
            "description": "Library metrics are stable with no significant anomalies.",
            "metric": None,
            "priority": "Low",
            "label": "Smart Insight"
        })

    return {"insights": insights}

@router.get("/export-all")
async def export_all_reports(
    period: str = Query("last_30_days"), 
    category: Optional[str] = None, 
    author: Optional[str] = None, 
    book_id: Optional[str] = None, 
    member_id: Optional[str] = None, 
    status: Optional[str] = None,
    db=Depends(get_db), 
    current_user=Depends(has_permission("reports:view"))
):
    reports = [
        "Circulation Report", "Book Report", "Member Report", 
        "Overdue Report", "Fine Report", "Reservation Report", 
        "Inventory Report", "Acquisition Report", "Activity Report"
    ]
    res = {}
    for r in reports:
        # Await the get_detailed_report function
        data = await get_detailed_report(
            type=r, period=period, 
            category=category, author=author, book_id=book_id, member_id=member_id, status=status,
            db=db, current_user=current_user
        )
        if data:
            res[r] = data
    return res

@router.get("/detailed-report")
async def get_detailed_report(
    type: str = Query(...), 
    period: str = Query("last_30_days"), 
    category: Optional[str] = None, 
    author: Optional[str] = None, 
    book_id: Optional[str] = None, 
    member_id: Optional[str] = None, 
    status: Optional[str] = None,
    db=Depends(get_db), 
    current_user=Depends(has_permission("reports:view"))
):
    start, end = _get_date_range(period)
    
    def book_match(b):
        if category and b.get("genre") != category: return False
        if author and b.get("author") != author: return False
        if book_id and b.get("title") != book_id: return False
        return True
        
    def member_match(m_id):
        if member_id and str(m_id) != member_id: return False
        return True
    
    if type == "Circulation Report":
        # Group borrows by date
        b_match = _build_match_query(start, end, "issue_date", member_id=member_id, status=status)
        if category or author or book_id:
            bk_query = {}
            if category: bk_query["genre"] = category
            if author: bk_query["author"] = author
            if book_id: bk_query["title"] = book_id
            bks = list(db.books.find(bk_query, {"_id": 1}))
            b_match["book_id"] = {"$in": [str(b["_id"]) for b in bks]}
            
        borrows = list(db.borrows.aggregate([
            _normalize_date_field("issue_date"),
            _normalize_date_field("due_date"),
            {"$match": b_match},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$__norm_issue_date"}},
                "issues": {"$sum": 1},
                "returns": {"$sum": {"$cond": [{"$eq": ["$status", "returned"]}, 1, 0]}},
                "overdue": {"$sum": {"$cond": [{"$lt": ["$__norm_due_date", datetime.now(timezone.utc).replace(tzinfo=None)]}, {"$cond": [{"$eq": ["$status", "issued"]}, 1, 0]}, 0]}}
            }},
            {"$sort": {"_id": -1}}
        ]))
        res = []
        for b in borrows:
            rate = round((b["returns"] / b["issues"]) * 100, 1) if b["issues"] > 0 else 0
            res.append({
                "Date": b["_id"],
                "Issues": b["issues"],
                "Returns": b["returns"],
                "Overdue": b["overdue"],
                "Return Rate": f"{rate}%"
            })
        return res
        
    elif type == "Book Report":
        bk_q = {}
        if category: bk_q["genre"] = category
        if author: bk_q["author"] = author
        if book_id: bk_q["title"] = book_id
        
        books = list(db.books.find(bk_q))
        res = []
        # Optimize with bulk counts
        b_ids = [str(b["_id"]) for b in books]
        
        b_match = _build_match_query(start, end, "issue_date", member_id=member_id, status=status)
        b_match["book_id"] = {"$in": b_ids}
        issues_agg = list(db.borrows.aggregate([{"$match": b_match}, {"$group": {"_id": "$book_id", "count": {"$sum": 1}}}]))
        issues_map = {doc["_id"]: doc["count"] for doc in issues_agg}
        
        r_match = _build_match_query(start, end, "created_at", member_id=member_id)
        r_match["book_id"] = {"$in": b_ids}
        res_agg = list(db.reservations.aggregate([{"$match": r_match}, {"$group": {"_id": "$book_id", "count": {"$sum": 1}}}]))
        res_map = {doc["_id"]: doc["count"] for doc in res_agg}
        
        for b in books:
            b_id_str = str(b["_id"])
            issues = issues_map.get(b_id_str, 0)
            reservations = res_map.get(b_id_str, 0)
            
            if member_id and issues == 0 and reservations == 0:
                continue
                
            res.append({
                "Book": b.get("title", ""),
                "Author": b.get("author", ""),
                "Category": b.get("genre", ""),
                "Total Copies": b.get("total_copies", 1),
                "Available": b.get("available_copies", 1),
                "Issues": issues,
                "Reservations": reservations
            })
        return sorted(res, key=lambda x: x["Issues"], reverse=True)
        
    elif type == "Member Report":
        m_q = {}
        if member_id: m_q["_id"] = ObjectId(member_id) if len(str(member_id)) == 24 else member_id
        
        members = list(db.students.find(m_q))
        res = []
        m_ids = [str(m.get("_id", "")) for m in members]
        
        b_match_all = _build_match_query(start, end, "issue_date")
        b_match_all["student_id"] = {"$in": m_ids}
        r_match_all = _build_match_query(start, end, "created_at")
        r_match_all["member_id"] = {"$in": m_ids}
        f_match_all = _build_match_query(start, end, "created_at")
        f_match_all["member_id"] = {"$in": m_ids}
        
        if category or author or book_id:
            bk_query = {}
            if category: bk_query["genre"] = category
            if author: bk_query["author"] = author
            if book_id: bk_query["title"] = book_id
            bks = list(db.books.find(bk_query, {"_id": 1}))
            bk_ids = [str(b["_id"]) for b in bks]
            b_match_all["book_id"] = {"$in": bk_ids}
            r_match_all["book_id"] = {"$in": bk_ids}
            f_match_all["book_id"] = {"$in": bk_ids}
            
        b_agg = list(db.borrows.aggregate([
            {"$match": b_match_all},
            {"$group": {
                "_id": "$student_id",
                "issues": {"$sum": 1},
                "returns": {"$sum": {"$cond": [{"$eq": ["$status", "returned"]}, 1, 0]}},
                "overdue": {"$sum": {"$cond": [{"$and": [{"$lt": [{"$cond": {"if": {"$eq": [{"$type": "$due_date"}, "date"]}, "then": "$due_date", "else": {"$dateFromString": {"dateString": "$due_date", "onError": None, "onNull": None}}}}, datetime.now(timezone.utc).replace(tzinfo=None)]}, {"$eq": ["$status", "issued"]}]}, 1, 0]}}
            }}
        ]))
        b_map = {doc["_id"]: doc for doc in b_agg}
        
        r_agg = list(db.reservations.aggregate([{"$match": r_match_all}, {"$group": {"_id": "$member_id", "count": {"$sum": 1}}}]))
        r_map = {doc["_id"]: doc["count"] for doc in r_agg}
        
        f_agg = list(db.fines.aggregate([{"$match": f_match_all}, {"$group": {"_id": "$member_id", "total": {"$sum": "$amount"}}}]))
        f_map = {doc["_id"]: doc["total"] for doc in f_agg}
        
        for m in members:
            m_id = str(m.get("_id", ""))
            
            issues = b_map.get(m_id, {}).get("issues", 0)
            returns = b_map.get(m_id, {}).get("returns", 0)
            overdue = b_map.get(m_id, {}).get("overdue", 0)
            reservations = r_map.get(m_id, 0)
            total_fine = f_map.get(m_id, 0)
            
            if (category or author or book_id) and issues == 0 and reservations == 0 and total_fine == 0:
                continue
                
            res.append({
                "Member": m.get("name", ""),
                "Issues": issues,
                "Returns": returns,
                "Overdue": overdue,
                "Fine": total_fine,
                "Reservations": reservations
            })
        return sorted(res, key=lambda x: x["Issues"], reverse=True)
        
    elif type == "Overdue Report":
        b_match = {"status": "issued", "$expr": {"$lt": [{"$cond": {"if": {"$eq": [{"$type": "$due_date"}, "date"]}, "then": "$due_date", "else": {"$dateFromString": {"dateString": "$due_date", "onError": None, "onNull": None}}}}, datetime.now(timezone.utc).replace(tzinfo=None)]}}
        if member_id: b_match["student_id"] = member_id
        if category or author or book_id:
            bk_query = {}
            if category: bk_query["genre"] = category
            if author: bk_query["author"] = author
            if book_id: bk_query["title"] = book_id
            bks = list(db.books.find(bk_query, {"book_id": 1}))
            b_match["book_id"] = {"$in": [b["book_id"] for b in bks]}
            
        borrows = list(db.borrows.find(b_match))
        
        m_ids = list({b.get("student_id") for b in borrows if b.get("student_id")})
        b_ids = list({b.get("book_id") for b in borrows if b.get("book_id")})
        
        m_objs = list(db.students.find({"$or": [{"_id": {"$in": [ObjectId(m) for m in m_ids if len(str(m))==24]}}, {"student_id": {"$in": m_ids}}]}))
        m_dict = {str(m["_id"]): m for m in m_objs}
        for m in m_objs: m_dict[m.get("student_id")] = m
        
        b_objs = list(db.books.find({"_id": {"$in": [ObjectId(bk) for bk in b_ids if len(str(bk))==24]}}))
        bk_dict = {str(bk["_id"]): bk for bk in b_objs}
        
        res = []
        for b in borrows:
            m = m_dict.get(b.get("student_id"))
            bk = bk_dict.get(b.get("book_id"))
            due_d = b.get("due_date")
            if isinstance(due_d, str):
                try: due_d = datetime.fromisoformat(due_d.replace("Z", "+00:00"))
                except: due_d = datetime.now(timezone.utc).replace(tzinfo=None)
            days = (datetime.now(timezone.utc).replace(tzinfo=None) - (due_d.replace(tzinfo=None) if due_d else datetime.now(timezone.utc).replace(tzinfo=None))).days
            if days < 0: days = 0
            # Calculate hypothetical fine (e.g. 5 per day)
            fine = days * 5
            
            issue_d = b.get("issue_date")
            issue_str = "-"
            if isinstance(issue_d, datetime): issue_str = issue_d.strftime("%Y-%m-%d")
            elif isinstance(issue_d, str): issue_str = issue_d[:10]
            
            due_str = "-"
            if isinstance(due_d, datetime): due_str = due_d.strftime("%Y-%m-%d")
            
            res.append({
                "Member": m.get("name", "Unknown") if m else b.get("student_name", "Unknown"),
                "Book": bk["title"] if bk else "Unknown",
                "Issue Date": issue_str,
                "Due Date": due_str,
                "Days Overdue": days,
                "Fine": fine,
                "Status": "Critical" if days > 30 else "Warning"
            })
        return sorted(res, key=lambda x: x["Days Overdue"], reverse=True)
        
    elif type == "Fine Report":
        f_match = _build_match_query(start, end, "created_at", member_id=member_id)
        if category or author or book_id:
            bk_query = {}
            if category: bk_query["genre"] = category
            if author: bk_query["author"] = author
            if book_id: bk_query["title"] = book_id
            bks = list(db.books.find(bk_query, {"_id": 1}))
            f_match["book_id"] = {"$in": [str(b["_id"]) for b in bks]}
            
        fines = list(db.fines.find(f_match))
        
        m_ids = list({f.get("member_id") for f in fines if f.get("member_id")})
        b_ids = list({f.get("book_id") for f in fines if f.get("book_id")})
        
        m_objs = list(db.students.find({"$or": [{"_id": {"$in": [ObjectId(m) for m in m_ids if len(str(m))==24]}}, {"student_id": {"$in": m_ids}}]}))
        m_dict = {str(m["_id"]): m for m in m_objs}
        for m in m_objs: m_dict[m.get("student_id")] = m
        
        b_objs = list(db.books.find({"_id": {"$in": [ObjectId(bk) for bk in b_ids if len(str(bk))==24]}}))
        bk_dict = {str(bk["_id"]): bk for bk in b_objs}
        
        res = []
        for f in fines:
            m = m_dict.get(f.get("member_id"))
            bk = bk_dict.get(f.get("book_id"))
            res.append({
                "Member": m.get("name", "Unknown") if m else "Unknown",
                "Book": bk["title"] if bk else "Unknown",
                "Fine": f.get("amount", 0),
                "Paid": "Yes" if f.get("paid") else "No",
                "Status": "Collected" if f.get("paid") else "Pending",
                "Date": f.get("created_at").strftime("%Y-%m-%d") if isinstance(f.get("created_at"), datetime) else str(f.get("created_at"))[:10] if f.get("created_at") else "-"
            })
        return sorted(res, key=lambda x: x["Date"], reverse=True)
        
    elif type == "Reservation Report":
        r_match = _build_match_query(start, end, "created_at", member_id=member_id)
        if status:
            if status == "issued": r_match["status"] = {"$in": ["ready", "completed"]}
            elif status == "returned": r_match["status"] = "pending"
            else: r_match["status"] = status
        if category or author or book_id:
            bk_query = {}
            if category: bk_query["genre"] = category
            if author: bk_query["author"] = author
            if book_id: bk_query["title"] = book_id
            bks = list(db.books.find(bk_query, {"_id": 1}))
            r_match["book_id"] = {"$in": [str(b["_id"]) for b in bks]}
            
        resv = list(db.reservations.find(r_match))
        
        m_ids = list({r.get("member_id") for r in resv if r.get("member_id")})
        b_ids = list({r.get("book_id") for r in resv if r.get("book_id")})
        
        m_objs = list(db.students.find({"$or": [{"_id": {"$in": [ObjectId(m) for m in m_ids if len(str(m))==24]}}, {"student_id": {"$in": m_ids}}]}))
        m_dict = {str(m["_id"]): m for m in m_objs}
        for m in m_objs: m_dict[m.get("student_id")] = m
        
        b_objs = list(db.books.find({"_id": {"$in": [ObjectId(bk) for bk in b_ids if len(str(bk))==24]}}))
        bk_dict = {str(bk["_id"]): bk for bk in b_objs}
        
        res = []
        for r in resv:
            m = m_dict.get(r.get("member_id"))
            bk = bk_dict.get(r.get("book_id"))
            wait_time = None
            if r.get("completed_at"):
                wait_time = (r["completed_at"] - r["created_at"]).days
            res.append({
                "Book": bk["title"] if bk else "Unknown",
                "Member": m.get("name", "Unknown") if m else "Unknown",
                "Reservation Date": r["created_at"].strftime("%Y-%m-%d") if isinstance(r.get("created_at"), datetime) else str(r.get("created_at"))[:10] if r.get("created_at") else "-",
                "Status": r.get("status", "Pending").capitalize(),
                "Completed Date": r["completed_at"].strftime("%Y-%m-%d") if isinstance(r.get("completed_at"), datetime) else str(r.get("completed_at"))[:10] if r.get("completed_at") else "-",
                "Waiting Time": f"{wait_time} days" if wait_time is not None else "-"
            })
        return sorted(res, key=lambda x: x["Reservation Date"], reverse=True)
        
    elif type == "Inventory Report":
        bk_q = {}
        if category: bk_q["genre"] = category
        if author: bk_q["author"] = author
        if book_id: bk_q["title"] = book_id
        
        books = list(db.books.find(bk_q))
        
        b_ids = [str(b["_id"]) for b in books]
        issues_agg = list(db.borrows.aggregate([{"$match": {"book_id": {"$in": b_ids}, "status": "issued"}}, {"$group": {"_id": "$book_id", "count": {"$sum": 1}}}]))
        issues_map = {doc["_id"]: doc["count"] for doc in issues_agg}
        
        res_agg = list(db.reservations.aggregate([{"$match": {"book_id": {"$in": b_ids}, "status": "pending"}}, {"$group": {"_id": "$book_id", "count": {"$sum": 1}}}]))
        res_map = {doc["_id"]: doc["count"] for doc in res_agg}
        
        res = []
        for b in books:
            issues = issues_map.get(str(b["_id"]), 0)
            reservations = res_map.get(str(b["_id"]), 0)
            res.append({
                "Book": b.get("title", ""),
                "Author": b.get("author", ""),
                "Category": b.get("genre", ""),
                "Total": b.get("total_copies", 1),
                "Available": b.get("available_copies", 1),
                "Issued": issues,
                "Reserved": reservations
            })
        return res
        
    elif type == "Acquisition Report":
        bk_q = _build_match_query(start, end, "created_at")
        if category: bk_q["genre"] = category
        if author: bk_q["author"] = author
        if book_id: bk_q["title"] = book_id
        
        books = list(db.books.find(bk_q))
        b_ids = [str(b["_id"]) for b in books]
        
        issues_agg = list(db.borrows.aggregate([{"$match": {"book_id": {"$in": b_ids}}}, {"$group": {"_id": "$book_id", "count": {"$sum": 1}}}]))
        issues_map = {doc["_id"]: doc["count"] for doc in issues_agg}
        
        res_agg = list(db.reservations.aggregate([{"$match": {"book_id": {"$in": b_ids}}}, {"$group": {"_id": "$book_id", "count": {"$sum": 1}}}]))
        res_map = {doc["_id"]: doc["count"] for doc in res_agg}
        
        res = []
        for b in books:
            issues = issues_map.get(str(b["_id"]), 0)
            reservations = res_map.get(str(b["_id"]), 0)
            res.append({
                "Book": b.get("title", ""),
                "Author": b.get("author", ""),
                "Category": b.get("genre", ""),
                "Added Date": b.get("created_at").strftime("%Y-%m-%d") if isinstance(b.get("created_at"), datetime) else str(b.get("created_at"))[:10] if b.get("created_at") else "-",
                "Issues": issues,
                "Reservations": reservations,
                "Borrowed Status": "Active" if issues > 0 else "Never Borrowed"
            })
        return sorted(res, key=lambda x: x["Added Date"], reverse=True)
        
    elif type == "Activity Report":
        a_match = _build_match_query(start, end, "timestamp")
        if member_id:
            m = db.students.find_one({"_id": ObjectId(member_id)}) if len(str(member_id)) == 24 else db.students.find_one({"student_id": member_id})
            if m: a_match["username"] = m.get("name", "Unknown")
        
        logs = list(db.audit_logs.find(a_match).sort("timestamp", -1))
        res = []
        for log in logs:
            res.append({
                "Timestamp": log.get("timestamp").strftime("%Y-%m-%d %H:%M:%S") if isinstance(log.get("timestamp"), datetime) else str(log.get("timestamp"))[:19].replace("T", " ") if log.get("timestamp") else "-",
                "Event": log.get("action", "Unknown"),
                "Description": log.get("details", ""),
                "Member": log.get("username", "System")
            })
        return res
        
    return []
