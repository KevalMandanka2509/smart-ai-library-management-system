from pymongo import MongoClient
from app.config import settings
import uuid

db = MongoClient(settings.MONGODB_URL)[settings.DATABASE_NAME]
books = list(db.books.find({"isbn": {"$exists": False}}))
count = 0
for book in books:
    new_isbn = str(uuid.uuid4()).replace("-", "")[:10]
    db.books.update_one({"_id": book["_id"]}, {"$set": {"isbn": new_isbn}})
    count += 1
print(f"Updated {count} books")
