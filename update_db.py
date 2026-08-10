import pymongo
client = pymongo.MongoClient('mongodb://localhost:27017/')
db = client['library_db']
db.users.update_many(
    {'role': 'librarian'}, 
    {'$set': {'permissions': ['books:read', 'books:write', 'authors:write', 'categories:write', 'borrows:manage', 'fines:manage', 'reservations:manage', 'students:manage', 'reports:view', 'contact:manage', 'notifications:manage', 'profile:read', 'profile:write']}}
)
print("Updated librarian permissions in DB")
