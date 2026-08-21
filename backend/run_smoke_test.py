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
books_col = db.books
students_col = db.students
transactions_col = db.transactions
reservations_col = db.reservations

temp_admin_email = "testadmin999@test.com"
temp_admin_password = "TestAdmin@123!"

temp_member_email = "testmember999@test.com"
temp_member_password = "TestMember@123!"

# Setup Test Users
users_col.delete_many({"email": {"$in": [temp_admin_email, temp_member_email]}})

admin_data = {
    "email": temp_admin_email,
    "username": "testadmin999",
    "password": security.hash_password(temp_admin_password),
    "full_name": "Test Admin",
    "role": "admin",
    "is_active": True,
}
users_col.insert_one(admin_data)

member_data = {
    "email": temp_member_email,
    "username": "testmember999",
    "password": security.hash_password(temp_member_password),
    "full_name": "Test Member",
    "role": "member",
    "is_active": True,
}
users_col.insert_one(member_data)

def login(email, password):
    resp = requests.post(f"{base_url}/api/v1/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json().get("access_token")
    return None

admin_token = login(temp_admin_email, temp_admin_password)
member_token = login(temp_member_email, temp_member_password)

results = {}

def run_test(name, condition):
    try:
        if condition():
            results[name] = "PASS"
        else:
            results[name] = "FAIL"
    except Exception as e:
        print(f"Error in {name}: {e}")
        results[name] = "FAIL"

# Auth
run_test("Auth", lambda: admin_token is not None and member_token is not None)

if admin_token:
    # Admin RBAC
    resp = requests.get(f"{base_url}/api/v1/reports/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    run_test("Admin RBAC", lambda: resp.status_code == 200)

    # Books CRUD
    book_data = {"title": "Test Book", "author": "Test Author", "isbn": "999999999", "total_copies": 5, "available_copies": 5, "category": "Test"}
    resp = requests.post(f"{base_url}/api/v1/books", headers={"Authorization": f"Bearer {admin_token}"}, json=book_data)
    if resp.status_code in [200, 201]:
        book_id = resp.json().get("_id") or resp.json().get("id")
        if not book_id and "_id" in resp.json():
            book_id = str(resp.json()["_id"])
        if book_id:
            resp = requests.delete(f"{base_url}/api/v1/books/{book_id}", headers={"Authorization": f"Bearer {admin_token}"})
            run_test("Books CRUD", lambda: resp.status_code in [200, 204])
        else:
            results["Books CRUD"] = "FAIL"
    else:
        results["Books CRUD"] = "FAIL"

if member_token:
    # Member RBAC (Negative)
    resp = requests.get(f"{base_url}/api/v1/reports/dashboard", headers={"Authorization": f"Bearer {member_token}"})
    run_test("Member RBAC", lambda: resp.status_code in [401, 403])

# Cleanup
users_col.delete_many({"email": {"$in": [temp_admin_email, temp_member_email]}})
books_col.delete_many({"isbn": "999999999"})

print("RESULTS:", results)
