import httpx
from pymongo import MongoClient
from datetime import datetime

BASE = "http://127.0.0.1:8000/api/v1"
ADMIN = {"email": "admin@library.com", "password": "TestAdmin@123!"}
MEMBER = {"email": "library.test.member01@example.com", "password": "QaTest@2026!"}

client = httpx.Client(timeout=10)
db = MongoClient("mongodb://127.0.0.1:27017")["library_db"]

def hdr(token):
    return {"Authorization": f"Bearer {token}"}

print("Logging in...")
admin_token = client.post(f"{BASE}/auth/login", json=ADMIN).json()["access_token"]
member_res = client.post(f"{BASE}/auth/login", json=MEMBER).json()
member_token = member_res["access_token"]
member_id = member_res["user"]["username"]

# Setup Book for reservation
book = db.books.find_one({"isbn": "TEST-AI-0000001"})
if not book:
    book = db.books.find_one({})
book_id_str = str(book["_id"])

# 6. RESERVATION TEST
print("\n--- RESERVATION TEST ---")
# Attempt reserve available book (Should fail)
db.books.update_one({"_id": book["_id"]}, {"$set": {"available_copies": 1}})
r = client.post(f"{BASE}/reservations/reserve", headers=hdr(member_token), json={"student_id": member_id, "book_id": book_id_str})
print("Reserve Available:", r.status_code)
assert r.status_code == 400

# Reserve unavailable book
db.borrows.delete_many({"student_id": member_id, "book_id": book_id_str, "status": "issued"})
db.reservations.delete_many({"student_id": member_id, "book_id": book_id_str})
db.books.update_one({"_id": book["_id"]}, {"$set": {"available_copies": 0}})

r = client.post(f"{BASE}/reservations/reserve", headers=hdr(member_token), json={"student_id": member_id, "book_id": book_id_str})
print("Reserve Unavailable:", r.status_code, r.text)
assert r.status_code == 200

# Duplicate reservation
r = client.post(f"{BASE}/reservations/reserve", headers=hdr(member_token), json={"student_id": member_id, "book_id": book_id_str})
print("Duplicate Reserve:", r.status_code)
assert r.status_code == 400

# Fetch reservation
r = client.get(f"{BASE}/reservations/active", headers=hdr(member_token))
active_res = r.json()
assert len(active_res) >= 1
res_id = active_res[0]["id"]

# Cancel reservation
r = client.post(f"{BASE}/reservations/cancel/{res_id}", headers=hdr(member_token))
print("Cancel Reservation:", r.status_code)
assert r.status_code == 200
print("Reservation Test PASSED.")

# 7. NOTIFICATIONS TEST
print("\n--- NOTIFICATIONS TEST ---")
r = client.get(f"{BASE}/notifications", headers=hdr(member_token))
print("Fetch Notifications:", r.status_code)
notifs = r.json()
if isinstance(notifs, dict):
    notifs = notifs.get("notifications", [])
if notifs:
    notif_id = notifs[0]["id"]
    r = client.post(f"{BASE}/notifications/read/{notif_id}", headers=hdr(member_token))
    print("Mark Notification Read:", r.status_code)
    assert r.status_code == 200
print("Notifications Test PASSED.")

# 8. ADMIN TEST
print("\n--- ADMIN PANEL TEST ---")
endpoints = [
    "/analytics/dashboard",
    "/admin/users",
    "/students",
    "/books",
    "/borrows/transactions",
    "/fines"
]
for ep in endpoints:
    r = client.get(f"{BASE}{ep}", headers=hdr(admin_token))
    assert r.status_code == 200, f"Admin failed on {ep} with {r.status_code}"
print("Admin Test PASSED.")

# 9. SECURITY / RBAC TEST
print("\n--- SECURITY / RBAC TEST ---")
for ep in ["/analytics/dashboard", "/admin/users", "/borrows/transactions", "/students"]:
    r = client.get(f"{BASE}{ep}", headers=hdr(member_token))
    print(f"Member access {ep}:", r.status_code)
    assert r.status_code in [401, 403]
print("Security Test PASSED.")

# 10. DATABASE CONSISTENCY
print("\n--- DB CONSISTENCY ---")
neg_books = list(db.books.find({"available_copies": {"$lt": 0}}))
assert len(neg_books) == 0, f"Found books with negative copies: {neg_books}"

dup_fines = list(db.fines.aggregate([{"$match": {"paid": False}}, {"$group": {"_id": "$borrow_id", "count": {"$sum": 1}}}, {"$match": {"count": {"$gt": 1}}}]))
assert len(dup_fines) == 0, f"Found duplicate fines: {dup_fines}"

print("DB Consistency Check PASSED.")

print("\nAll Tests Completed!")
