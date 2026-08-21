import sys
import requests
from pymongo import MongoClient
from app.config import settings
from app.core.security import security
from datetime import datetime, timedelta

base_url = "http://localhost:8000"
client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

admin_email = "admin@library.com"
admin_pw = "TestAdmin@123!"
member_email = "testmember999@test.com"
member_pw = "TestMember@123!"
librarian_email = "librarian999@test.com"
librarian_pw = "TestLibrarian@123!"

# Setup Test Users
db.users.delete_many({"email": {"$in": [member_email, librarian_email]}})
db.users.insert_many([
    {"email": member_email, "username": "testmember999", "password": security.hash_password(member_pw), "role": "member", "is_active": True},
    {"email": librarian_email, "username": "librarian999", "password": security.hash_password(librarian_pw), "role": "librarian", "is_active": True}
])

# Ensure Admin
db.users.update_one({"email": admin_email}, {"$set": {"password": security.hash_password(admin_pw), "is_active": True, "locked_until": None}})

# Students setup
db.students.delete_many({"email": member_email})
db.students.insert_one({"student_id": "testmember999", "email": member_email, "full_name": "Test Member", "course": "Test", "is_active": True})

def login(email, password):
    resp = requests.post(f"{base_url}/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json().get("access_token")

admin_tok = login(admin_email, admin_pw)
mem_tok = login(member_email, member_pw)
lib_tok = login(librarian_email, librarian_pw)

headers = {"Authorization": f"Bearer {admin_tok}"}
mem_headers = {"Authorization": f"Bearer {mem_tok}"}
lib_headers = {"Authorization": f"Bearer {lib_tok}"}

results = {}

# 1. Books CRUD
b_id = None
try:
    import uuid
    test_isbn = str(uuid.uuid4()).replace("-", "")[:10]
    book_data = {"title": "Test Book", "author": "Tester", "isbn": test_isbn, "total_copies": 5, "available_copies": 5, "genre": "Test"}
    resp = requests.post(f"{base_url}/api/v1/books", headers=headers, json=book_data)
    if resp.status_code in [200, 201]:
        b_id = resp.json().get("id") or str(resp.json().get("_id"))
        # we don't delete yet, we need it for borrows
        results["Books CRUD"] = "PASS"
    else:
        results["Books CRUD"] = f"FAIL {resp.status_code} - {resp.text}"
except Exception as e:
    results["Books CRUD"] = f"FAIL {e}"

# 2. Reports
try:
    resp = requests.get(f"{base_url}/api/v1/analytics/dashboard", headers=headers)
    results["Reports"] = "PASS" if resp.status_code == 200 else f"FAIL {resp.status_code}"
except Exception as e:
    results["Reports"] = f"FAIL {e}"

# 3. Borrow / Return
try:
    if b_id:
        borrow_data = {"student_id": "testmember999", "book_id": b_id}
        br_resp = requests.post(f"{base_url}/api/v1/borrows/issue", headers=headers, json=borrow_data)
        if br_resp.status_code == 200:
            ret_resp = requests.post(f"{base_url}/api/v1/borrows/return", headers=headers, json={"student_id": "testmember999", "book_id": b_id})
            results["Borrow/Return"] = "PASS" if ret_resp.status_code == 200 else f"FAIL {ret_resp.status_code} {ret_resp.text}"
        else:
            results["Borrow/Return"] = f"FAIL {br_resp.status_code} {br_resp.text}"
    else:
        results["Borrow/Return"] = "NOT TESTED (Book failed)"
except Exception as e:
    results["Borrow/Return"] = f"FAIL {e}"

# 4. Reservations
try:
        res_book = {"title": "Res Book", "author": "Tester", "isbn": str(uuid.uuid4()).replace("-", "")[:10], "total_copies": 1, "available_copies": 0, "genre": "Test"}
        resp_b = requests.post(f"{base_url}/api/v1/books", headers=headers, json=res_book)
        rb_id = resp_b.json().get("id") or str(resp_b.json().get("_id"))
        res_data = {"book_id": rb_id, "student_id": "testmember999"}
        resp = requests.post(f"{base_url}/api/v1/reservations/reserve", headers=headers, json=res_data)
        if resp.status_code in [200, 201]:
            resp_active = requests.get(f"{base_url}/api/v1/reservations/active", headers=headers)
            res_list = resp_active.json()
            res_id = None
            for r in res_list:
                if r.get("book_id") == rb_id:
                    res_id = r.get("id")
                    break
            if res_id:
                requests.post(f"{base_url}/api/v1/reservations/cancel/{res_id}", headers=headers)
                results["Reservations"] = "PASS"
            else:
                results["Reservations"] = "FAIL Missing ID in active list"
        else:
            results["Reservations"] = f"FAIL {resp.status_code} {resp.text}"
        if rb_id:
            requests.delete(f"{base_url}/api/v1/books/{rb_id}", headers=headers)
except Exception as e:
    results["Reservations"] = f"FAIL {e}"

# 5. Fines
try:
    resp = requests.get(f"{base_url}/api/v1/fines", headers=headers)
    results["Fines"] = "PASS" if resp.status_code == 200 else f"FAIL {resp.status_code}"
except Exception as e:
    results["Fines"] = f"FAIL {e}"

# 6. Notifications
try:
    resp = requests.get(f"{base_url}/api/v1/notifications", headers=headers)
    results["Notifications"] = "PASS" if resp.status_code == 200 else f"FAIL {resp.status_code}"
except Exception as e:
    results["Notifications"] = f"FAIL {e}"

# 7. Librarian RBAC
try:
    resp = requests.get(f"{base_url}/api/v1/books", headers=lib_headers)
    if resp.status_code == 200:
        bad_resp = requests.get(f"{base_url}/api/v1/admin/permissions", headers=lib_headers)
        if bad_resp.status_code in [401, 403]:
            results["Librarian RBAC"] = "PASS"
        else:
            results["Librarian RBAC"] = f"FAIL admin endpoint allowed: {bad_resp.status_code}"
    else:
        results["Librarian RBAC"] = f"FAIL books access denied: {resp.status_code}"
except Exception as e:
    results["Librarian RBAC"] = f"FAIL {e}"

# Cleanup
if b_id:
    requests.delete(f"{base_url}/api/v1/books/{b_id}", headers=headers)

db.users.delete_many({"email": {"$in": [member_email, librarian_email]}})
db.students.delete_many({"email": member_email})

for k,v in results.items():
    print(f"{k}: {v}")
