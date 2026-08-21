import sys
import requests
from pymongo import MongoClient
from app.config import settings
from app.core.security import security
from datetime import datetime

base_url = "http://localhost:8000"

client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]
users_col = db.users

temp_admin_email = "testadmin999@test.com"
temp_admin_password = "TestAdmin@123!"

def login(email, password):
    resp = requests.post(f"{base_url}/api/v1/auth/login", json={"email": email, "password": password})
    print(f"Login json response for {email}: {resp.status_code} - {resp.text}")
    if resp.status_code == 200:
        return resp.json().get("access_token")
    return None

login(temp_admin_email, temp_admin_password)
