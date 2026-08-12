from pymongo import MongoClient
from bson.objectid import ObjectId
import datetime

client = MongoClient('mongodb://localhost:27017/')
db = client['library_db']

member_id = "6a5dffa47dc57ec34ff1a484" # Member User

# 1. Add some real looking books
books = [
    {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "genre": "Fiction", "is_available": True, "available_copies": 3, "total_copies": 5},
    {"title": "1984", "author": "George Orwell", "genre": "Dystopian", "is_available": True, "available_copies": 2, "total_copies": 4},
    {"title": "To Kill a Mockingbird", "author": "Harper Lee", "genre": "Fiction", "is_available": True, "available_copies": 1, "total_copies": 3},
    {"title": "Pride and Prejudice", "author": "Jane Austen", "genre": "Romance", "is_available": True, "available_copies": 4, "total_copies": 5},
    {"title": "The Catcher in the Rye", "author": "J.D. Salinger", "genre": "Fiction", "is_available": False, "available_copies": 0, "total_copies": 2},
    {"title": "Sapiens", "author": "Yuval Noah Harari", "genre": "History", "is_available": True, "available_copies": 5, "total_copies": 5},
    {"title": "Dune", "author": "Frank Herbert", "genre": "Sci-Fi", "is_available": True, "available_copies": 2, "total_copies": 2}
]

res = db.books.insert_many(books)
book_ids = res.inserted_ids

print("Books inserted.")

# 2. Add some borrow history for the member
# Let's say they borrowed 'The Great Gatsby' (Fiction) and 'To Kill a Mockingbird' (Fiction)
borrows = [
    {
        "student_id": member_id,
        "book_id": str(book_ids[0]), # The Great Gatsby
        "issue_date": datetime.datetime.utcnow() - datetime.timedelta(days=10),
        "due_date": datetime.datetime.utcnow() + datetime.timedelta(days=4),
        "status": "issued"
    },
    {
        "student_id": member_id,
        "book_id": str(book_ids[2]), # To Kill a Mockingbird
        "issue_date": datetime.datetime.utcnow() - datetime.timedelta(days=30),
        "due_date": datetime.datetime.utcnow() - datetime.timedelta(days=16),
        "status": "returned",
        "return_date": datetime.datetime.utcnow() - datetime.timedelta(days=15)
    }
]

db.borrows.insert_many(borrows)
print("Borrow history added.")
