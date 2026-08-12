import json
from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017/')
db = client['library_db']

print("---- MEMBERS ----")
members = list(db.users.find({'role': 'member'}))
for member in members:
    name = member.get("name", member.get("full_name", "Unknown"))
    _id = member["_id"]
    borrows = list(db.borrows.find({'student_id': str(_id)}))
    print(f"Member: {name} ({_id}) - Borrows: {len(borrows)}")
    if borrows:
        book_ids = [b.get('book_id') for b in borrows]
        from bson.objectid import ObjectId
        valid_ids = []
        for bid in book_ids:
            if bid:
                try:
                    valid_ids.append(ObjectId(bid) if len(str(bid)) == 24 else bid)
                except:
                    valid_ids.append(bid)
        
        books = list(db.books.find({'_id': {'$in': valid_ids}}))
        print(f"  Borrowed Books: {[b.get('title') for b in books]}")

print("---- BOOKS ----")
books = list(db.books.find({}, {'title': 1, 'genre': 1, 'available_copies': 1}))
for b in books[:5]:
    print(b)
