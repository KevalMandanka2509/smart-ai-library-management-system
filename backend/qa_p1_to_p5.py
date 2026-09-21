import httpx
from pymongo import MongoClient
import time
from datetime import datetime, timedelta

BASE = "http://127.0.0.1:8000/api/v1"
ADMIN = {"email": "admin@library.com", "password": "TestAdmin@123!"}
MEMBER = {"email": "library.test.member01@example.com", "password": "QaTest@2026!"}

client = httpx.Client(timeout=10)
db = MongoClient("mongodb://127.0.0.1:27017")["library_db"]

def hdr(token):
    return {"Authorization": f"Bearer {token}"}

print("Logging in Admin...")
r = client.post(f"{BASE}/auth/login", json=ADMIN)
admin_token = r.json()["access_token"]

print("Logging in Member...")
r = client.post(f"{BASE}/auth/login", json=MEMBER)
member_token = r.json()["access_token"]
member_id = r.json()["user"]["username"] # typically qa_member01

# Fetch ACTUAL settings
config = db.settings.find_one({"_id": "global_config"})
rate = config["fine"]["daily_fine_rate"] if config and "fine" in config else 2.0
grace = config["borrow"]["grace_period_days"] if config and "borrow" in config else 2
max_fine = config["fine"]["max_fine_per_book"] if config and "fine" in config else 10.0
print(f"ACTUAL CONFIG: Rate={rate}, Grace={grace}, Max={max_fine}")

# Setup Book
book = db.books.find_one({"isbn": "TEST-AI-0000001"})
if not book:
    book = db.books.find_one({})
book_id_str = str(book["_id"])
print(f"Testing with Book: {book['title']} ({book_id_str})")

# Clean existing state
db.borrows.delete_many({"student_id": member_id})
db.fines.delete_many({"student_id": member_id})
db.books.update_one({"_id": book["_id"]}, {"$set": {"available_copies": 3, "total_copies": 3, "is_available": True}})

# 1. BORROW TEST
print("\n--- BORROW TEST ---")
r_issue = client.post(f"{BASE}/borrows/issue", headers=hdr(admin_token), json={"student_id": member_id, "book_id": book_id_str})
print("Issue Status:", r_issue.status_code, r_issue.text)
assert r_issue.status_code == 200, "Borrow failed!"

# Verify DB
borrow = db.borrows.find_one({"student_id": member_id, "book_id": book_id_str, "status": "issued"})
assert borrow, "Borrow record not found in DB!"
b_updated = db.books.find_one({"_id": book["_id"]})
assert b_updated["available_copies"] == 2, "Available copies not decremented!"
print("Borrow Test PASSED.")

# 2. OVERDUE SETUP
print("\n--- OVERDUE SETUP ---")
now = datetime.utcnow()
db.borrows.update_one(
    {"_id": borrow["_id"]},
    {"$set": {
        "issue_date": now - timedelta(days=20),
        "due_date": now - timedelta(days=10) # 10 days overdue
    }}
)
print("Backdated borrow record to make it 10 days overdue.")

# 3. RETURN TEST (Generates Penalty)
print("\n--- RETURN & PENALTY TEST ---")
r_return = client.post(f"{BASE}/borrows/return", headers=hdr(admin_token), json={"student_id": member_id, "book_id": book_id_str})
print("Return Status:", r_return.status_code, r_return.text)
assert r_return.status_code == 200, "Return failed!"

b_returned = db.books.find_one({"_id": book["_id"]})
assert b_returned["available_copies"] == 3, "Available copies not incremented after return!"

fine = db.fines.find_one({"borrow_id": str(borrow["_id"])})
assert fine, "Fine record not created!"

# Calculate expected fine
overdue_days = 10
chargeable = max(0, overdue_days - grace)
expected_amount = min(chargeable * rate, max_fine)
print(f"Fine Amount generated: {fine['amount']}, Expected: {expected_amount}")
assert abs(fine["amount"] - expected_amount) < 0.01, f"Fine mismatch! Expected {expected_amount} got {fine['amount']}"
print("Return & Penalty Test PASSED.")

# 4. PAYMENT TEST
print("\n--- PAYMENT TEST ---")
fine_id_str = str(fine["_id"])
r_pay = client.post(f"{BASE}/fines/pay", headers=hdr(member_token), json={"fine_id": fine_id_str, "amount": 999.0})
print("Pay Status:", r_pay.status_code, r_pay.text)
assert r_pay.status_code == 200, "Payment failed!"

fine_paid = db.fines.find_one({"_id": fine["_id"]})
assert fine_paid["paid"] == True, "Fine not marked as paid in DB!"

# Duplicate payment
r_pay_dup = client.post(f"{BASE}/fines/pay", headers=hdr(member_token), json={"fine_id": fine_id_str, "amount": fine['amount']})
print("Duplicate Pay Status (should be 400):", r_pay_dup.status_code)
assert r_pay_dup.status_code == 400, "Duplicate payment succeeded!"
print("Payment Test PASSED.")

print("\nAll Workflows Completed Successfully!")
