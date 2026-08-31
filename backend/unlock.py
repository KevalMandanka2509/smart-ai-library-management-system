import pymongo
db = pymongo.MongoClient('mongodb://localhost:27017/').get_database('library_db')
res = db.users.update_many({'email': 'admin@yourlibrary.com'}, {'$unset': {'locked_until': ''}, '$set': {'failed_login_attempts': 0}})
print('modified admin@yourlibrary.com:', res.modified_count)
res2 = db.users.update_many({'email': 'admin@library.com'}, {'$unset': {'locked_until': ''}, '$set': {'failed_login_attempts': 0}})
print('modified admin@library.com:', res2.modified_count)
