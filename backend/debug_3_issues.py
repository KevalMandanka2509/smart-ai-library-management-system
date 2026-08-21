import sys
import requests
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
librarian_email = "librarian999@test.com"
librarian_pw = "TestLibrarian@123!"

def setup_users():
    db.users.delete_many({"email": {"$in": [member_email, librarian_email]}})
    db.users.insert_many([
        {"email": member_email, "username": "testmember999", "password": security.hash_password(member_pw), "role": "member", "is_active": True},
        {"email": librarian_email, "username": "librarian999", "password": security.hash_password(librarian_pw), "role": "librarian", "is_active": True}
    ])
    db.users.update_one({"email": admin_email}, {"$set": {"password": security.hash_password(admin_pw), "is_active": True, "locked_until": None}})
    db.students.delete_many({"email": member_email})
    db.students.insert_one({"student_id": "testmember999", "email": member_email, "full_name": "Test Member", "course": "Test", "is_active": True})

def get_token(email, pw):
    resp = requests.post(f"{base_url}/api/v1/auth/login", json={"email": email, "password": pw})
    return resp.json().get("access_token")

setup_users()
admin_tok = get_token(admin_email, admin_pw)
lib_tok = get_token(librarian_email, librarian_pw)
mem_tok = get_token(member_email, member_pw)

admin_hdr = {"Authorization": f"Bearer {admin_tok}"}
lib_hdr = {"Authorization": f"Bearer {lib_tok}"}
mem_hdr = {"Authorization": f"Bearer {mem_tok}"}

# 1. Borrow Test
book_id = None
try:
    resp = requests.post(f"{base_url}/api/v1/books", headers=admin_hdr, json={"title": "Borrow Test Book", "author": "Tester", "isbn": "BORROW1234", "total_copies": 2, "available_copies": 2})
    book_id = resp.json().get("id") or str(resp.json().get("_id"))
    
    # Issue
    iss = requests.post(f"{base_url}/api/v1/borrows/issue", headers=admin_hdr, json={"student_id": "testmember999", "book_id": book_id})
    print("Borrow Issue Status:", iss.status_code)
    try:
        print("Borrow Issue JSON keys:", list(iss.json().keys()))
        print("Borrow Issue full JSON:", iss.json())
    except:
        print("Borrow Issue Text:", iss.text)
except Exception as e:
    print("Borrow Setup Error:", e)

# 2. Reservation Route Check
try:
    res = requests.post(f"{base_url}/api/v1/reservations", headers=mem_hdr, json={"student_id": "testmember999", "book_id": book_id})
    print("Reservation POST Status:", res.status_code)
    print("Reservation POST Text:", res.text)
except Exception as e:
    print("Reservation Test Error:", e)

# 3. Librarian RBAC
try:
    lib_bk = requests.get(f"{base_url}/api/v1/books", headers=lib_hdr)
    print("Librarian Books Status:", lib_bk.status_code)
    try:
        print("Librarian Books JSON:", lib_bk.json())
    except:
        print("Librarian Books Text:", lib_bk.text)
except Exception as e:
    print("Librarian Books Test Error:", e)

# Cleanup
if book_id:
    requests.delete(f"{base_url}/api/v1/books/{book_id}", headers=admin_hdr)
db.users.delete_many({"email": {"$in": [member_email, librarian_email]}})
db.students.delete_many({"email": member_email})
