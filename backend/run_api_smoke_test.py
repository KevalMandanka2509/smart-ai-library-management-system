import sys
import requests
import time
from pymongo import MongoClient
from app.config import settings
from app.core.security import security

base_url = "http://localhost:8000"
client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

admin_email = "admin@library.com"
admin_pw = "TestAdmin@123!"
member_email = "testmember999@test.com"
member_pw = "TestMember@123!"

# Ensure test users
db.users.delete_many({"email": member_email})
db.users.insert_one({
    "email": member_email,
    "username": "testmember999",
    "password": security.hash_password(member_pw),
    "role": "member",
    "is_active": True,
})

db.users.update_one({"email": admin_email}, {"$set": {"password": security.hash_password(admin_pw), "is_active": True}})

def do_login(email, password):
    resp = requests.post(f"{base_url}/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json().get("access_token")

admin_token = do_login(admin_email, admin_pw)
member_token = do_login(member_email, member_pw)
headers = {"Authorization": f"Bearer {admin_token}"}
mem_headers = {"Authorization": f"Bearer {member_token}"}

results = {}

# 1. Books CRUD
try:
    b = requests.post(f"{base_url}/api/v1/books", headers=headers, json={
        "title": "Smoke Test Book", "author": "Tester", "isbn": "SMOKE123", "total_copies": 2, "available_copies": 2, "category": "Test"
    })
    b_id = b.json().get("id") or b.json().get("_id")
    if not b_id and "_id" in b.json(): b_id = str(b.json()["_id"])
    requests.get(f"{base_url}/api/v1/books", headers=headers)
    requests.delete(f"{base_url}/api/v1/books/{b_id}", headers=headers)
    results["Books CRUD"] = "PASS" if b.status_code in [200, 201] else f"FAIL {b.status_code}"
except Exception as e:
    results["Books CRUD"] = f"FAIL {e}"

# 2. Students CRUD
try:
    s = requests.post(f"{base_url}/api/v1/students", headers=headers, json={
        "student_id": "STU999", "full_name": "Test Stu", "email": "stu999@test.com", "course": "CS"
    })
    s_id = s.json().get("id") or s.json().get("_id")
    requests.get(f"{base_url}/api/v1/students", headers=headers)
    if s_id:
        requests.delete(f"{base_url}/api/v1/students/{s_id}", headers=headers)
    results["Students CRUD"] = "PASS" if s.status_code in [200, 201] else f"FAIL {s.status_code}"
except Exception as e:
    results["Students CRUD"] = f"FAIL {e}"

# 7. Reports
try:
    r = requests.get(f"{base_url}/api/v1/reports/dashboard", headers=headers)
    results["Reports & Analytics"] = "PASS" if r.status_code == 200 else f"FAIL {r.status_code}"
except Exception as e:
    results["Reports & Analytics"] = f"FAIL {e}"

print(results)
