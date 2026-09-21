import pymongo
db = pymongo.MongoClient('mongodb://127.0.0.1:27017')['library_db']
db.users.update_one({'email': 'library.test.librarian01@example.com'}, {'$unset': {'permissions': 1}})
