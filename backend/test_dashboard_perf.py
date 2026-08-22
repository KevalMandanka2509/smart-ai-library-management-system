import asyncio
import time
from datetime import datetime, timedelta
from app.database import db

async def test_dashboard():
    database = db.get_db()
    now = datetime.utcnow()
    start_30 = now - timedelta(days=30)
    start_7 = now - timedelta(days=7)
    start_90 = now - timedelta(days=90)
    
    queries = [
        ("books.estimated_document_count", lambda: database.books.estimated_document_count()),
        ("books.count_documents available", lambda: database.books.count_documents({"is_available": True})),
        ("books genre aggregate", lambda: list(database.books.aggregate([
            {"$group": {"_id": {"$ifNull": ["$genre", "Uncategorized"]}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20}
        ]))),
        ("borrows total issued", lambda: database.borrows.count_documents({"status": "issued"})),
        ("borrows total returned", lambda: database.borrows.count_documents({"status": "returned"})),
        ("borrows overdue", lambda: database.borrows.count_documents({"status": "issued", "due_date": {"$lt": now}})),
        ("borrows new 7d", lambda: database.borrows.count_documents({"issue_date": {"$gte": start_7}})),
        ("students estimated_document_count", lambda: database.students.estimated_document_count()),
        ("students active", lambda: database.students.count_documents({"is_active": True})),
        ("active borrowers 30d", lambda: list(database.borrows.aggregate([
            {"$match": {"issue_date": {"$gte": start_30}}},
            {"$group": {"_id": "$student_id"}},
            {"$count": "n"}
        ]))),
        ("fines aggregate", lambda: list(database.fines.aggregate([
            {"$group": {
                "_id": "$paid",
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }}
        ]))),
        ("popular books 90d", lambda: list(database.borrows.aggregate([
            {"$match": {"issue_date": {"$gte": start_90}}},
            {"$group": {
                "_id": "$book_id",
                "title": {"$first": "$book_title"},
                "borrow_count": {"$sum": 1}
            }},
            {"$sort": {"borrow_count": -1}},
            {"$limit": 10},
            {"$project": {"_id": 0, "book_id": "$_id", "title": 1, "borrow_count": 1}}
        ]))),
        ("top students 90d", lambda: list(database.borrows.aggregate([
            {"$match": {"issue_date": {"$gte": start_90}}},
            {"$group": {
                "_id": "$student_id",
                "name": {"$first": "$student_name"},
                "borrow_count": {"$sum": 1}
            }},
            {"$sort": {"borrow_count": -1}},
            {"$limit": 10},
            {"$project": {"_id": 0, "student_id": "$_id", "name": 1, "borrow_count": 1}}
        ]))),
        ("trend issue 90d", lambda: list(database.borrows.aggregate([
            {"$match": {"issue_date": {"$gte": start_90}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$issue_date"}},
                "count": {"$sum": 1}
            }}
        ]))),
        ("trend return 90d", lambda: list(database.borrows.aggregate([
            {"$match": {"return_date": {"$gte": start_90, "$ne": None}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$return_date"}},
                "count": {"$sum": 1}
            }}
        ]))),
        ("recent transactions", lambda: list(database.borrows.find({}, {
            "student_name": 1, "book_title": 1, "issue_date": 1,
            "due_date": 1, "return_date": 1, "status": 1
        }).sort("issue_date", -1).limit(10)))
    ]
    
    for name, func in queries:
        t0 = time.time()
        func()
        t1 = time.time()
        duration = t1 - t0
        print(f"{name}: {duration:.4f}s")
        if duration > 1.0:
            print(f"!!! WARNING: {name} is slow!")

if __name__ == "__main__":
    asyncio.run(test_dashboard())
