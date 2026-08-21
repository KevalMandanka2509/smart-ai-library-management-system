import sys
import requests
from pymongo import MongoClient
from app.config import settings
from app.core.security import security

client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]
users_col = db.users

email = "admin@library.com"
password = "TestAdmin@123!"

# Update password
users_col.update_one({"email": email}, {"$set": {"password": security.hash_password(password), "login_attempts": 0, "locked_until": None}})

# Try login
resp = requests.post("http://localhost:8000/api/v1/auth/login", json={"email": email, "password": password})
print(f"Login response for {email}: {resp.status_code} - {resp.text}")
