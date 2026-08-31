import bcrypt
import pymongo

hashed = bcrypt.hashpw(b'Admin@123', bcrypt.gensalt(rounds=12)).decode('utf-8')
db = pymongo.MongoClient('mongodb://localhost:27017/').get_database('library_db')

db.users.update_one(
    {'email': 'admin@library.com'}, 
    {'$set': {'password': hashed, 'failed_login_attempts': 0}, '$unset': {'locked_until': ''}}
)
print("Password reset for admin@library.com")
