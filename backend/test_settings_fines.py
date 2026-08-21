import asyncio
import httpx
from pymongo import MongoClient
from app.config import settings
from app.core.security import security
from datetime import datetime, timedelta
from bson import ObjectId

base_url = "http://localhost:8000"
client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

admin_email = "admin@library.com"
admin_pw = "TestAdmin@123!"
member_email = "testmember999@test.com"
member_pw = "TestMember@123!"

results = []

def log_result(test_name, passed, msg=""):
    results.append((test_name, passed, msg))
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {test_name}: {msg}")

def setup_db():
    # Setup member
    db.users.delete_many({"email": member_email})
    db.users.insert_one({"email": member_email, "username": "testmember999", "password": security.hash_password(member_pw), "role": "member", "is_active": True})
    
    db.students.delete_many({"student_id": "testmember999"})
    db.students.insert_one({"student_id": "testmember999", "email": member_email, "full_name": "Test Member", "course": "Test", "is_active": True})
    
    # Create 3 Books
    db.books.delete_many({"genre": "TestSettings"})
    db.borrows.delete_many({"student_id": "testmember999"})
    db.fines.delete_many({"student_id": "testmember999"})
    
    book_ids = []
    for i in range(3):
        res = db.books.insert_one({
            "title": f"Settings Book {i}",
            "author": "Tester",
            "isbn": f"111111111{i}",
            "total_copies": 2,
            "available_copies": 2,
            "is_available": True,
            "genre": "TestSettings"
        })
        book_ids.append(str(res.inserted_id))
    return book_ids

def update_settings(update_dict):
    config = db.settings.find_one({"_id": "global_config"})
    if not config:
        config = {"_id": "global_config", "library": {}, "borrow": {}, "fine": {}}
    
    for k, v in update_dict.items():
        if k in ["max_books_per_student", "allow_renewals", "max_renew_count", "max_reservation_days"]:
            config.setdefault("library", {})[k] = v
        elif k in ["default_borrow_days", "grace_period_days", "block_borrow_on_unpaid_fine", "max_fine_limit_for_borrow"]:
            config.setdefault("borrow", {})[k] = v
        elif k in ["daily_fine_rate", "max_fine_per_book"]:
            config.setdefault("fine", {})[k] = v
            
    db.settings.update_one({"_id": "global_config"}, {"$set": config}, upsert=True)

async def get_token():
    async with httpx.AsyncClient() as client_session:
        resp = await client_session.post(f"{base_url}/api/v1/auth/login", json={"email": admin_email, "password": admin_pw})
        admin_tok = resp.json().get("access_token")
        
        resp = await client_session.post(f"{base_url}/api/v1/auth/login", json={"email": member_email, "password": member_pw})
        mem_tok = resp.json().get("access_token")
        
        return admin_tok, mem_tok

async def main():
    book_ids = setup_db()
    admin_tok, mem_tok = await get_token()
    admin_headers = {"Authorization": f"Bearer {admin_tok}"}
    mem_headers = {"Authorization": f"Bearer {mem_tok}"}
    
    async with httpx.AsyncClient() as c:
        # TEST 1: max_books_per_student = 1
        update_settings({"max_books_per_student": 1})
        resp1 = await c.post(f"{base_url}/api/v1/borrows/issue", headers=admin_headers, json={"student_id": "testmember999", "book_id": book_ids[0]})
        log_result("Settings: Borrow Book 1", resp1.status_code == 200, "Should succeed")
        
        resp2 = await c.post(f"{base_url}/api/v1/borrows/issue", headers=admin_headers, json={"student_id": "testmember999", "book_id": book_ids[1]})
        log_result("Settings: Max Books Limit", resp2.status_code == 400 and "maximum borrow limit" in resp2.text, f"Should fail with max limit error. Code: {resp2.status_code}, Msg: {resp2.text}")
        
        # TEST 2: allow_renewals = False
        update_settings({"allow_renewals": False, "max_books_per_student": 5})
        resp3 = await c.post(f"{base_url}/api/v1/borrows/renew", headers=mem_headers, json={"student_id": "testmember999", "book_id": book_ids[0]})
        log_result("Settings: Allow Renewals=False", resp3.status_code == 400 and "renewals are currently disabled" in resp3.text.lower(), f"Should fail. Code: {resp3.status_code}")
        
        # TEST 3: max_renew_count = 1
        update_settings({"allow_renewals": True, "max_renew_count": 1})
        resp4 = await c.post(f"{base_url}/api/v1/borrows/renew", headers=mem_headers, json={"student_id": "testmember999", "book_id": book_ids[0]})
        log_result("Settings: Renew Book 1", resp4.status_code == 200, "First renewal should succeed")
        resp5 = await c.post(f"{base_url}/api/v1/borrows/renew", headers=mem_headers, json={"student_id": "testmember999", "book_id": book_ids[0]})
        log_result("Settings: Max Renew Limit", resp5.status_code == 400 and "maximum renewal limit" in resp5.text.lower(), "Second renewal should fail")
        
        # TEST 4: Fine lifecycle (overdue + max fine cap)
        # Manually alter the borrow record in DB to be overdue by 10 days
        now = datetime.utcnow()
        due_date = now - timedelta(days=10)
        db.borrows.update_one({"student_id": "testmember999", "book_id": book_ids[0]}, {"$set": {"due_date": due_date}})
        
        update_settings({"grace_period_days": 2, "daily_fine_rate": 2.0, "max_fine_per_book": 10.0, "block_borrow_on_unpaid_fine": True, "max_fine_limit_for_borrow": 5.0})
        # If 10 days overdue, grace=2 => 8 chargeable days * 2.0 = 16.0
        # But max_fine_per_book = 10.0 => should cap at 10.0
        resp6 = await c.post(f"{base_url}/api/v1/borrows/return", headers=admin_headers, json={"student_id": "testmember999", "book_id": book_ids[0]})
        log_result("Fines: Return Overdue Book", resp6.status_code == 200, "Should succeed")
        
        # Verify fine in DB
        fine = db.fines.find_one({"student_id": "testmember999"})
        if fine:
            amount = float(fine.get("amount", 0))
            log_result("Fines: Max Fine Cap", amount == 10.0, f"Expected fine amount 10.0, got {amount}")
        else:
            log_result("Fines: Fine Generation", False, "Fine record not found")
        
        # TEST 5: Block borrow on unpaid fine
        # Fine is 10.0, limit is 5.0 => Should block borrow
        resp7 = await c.post(f"{base_url}/api/v1/borrows/issue", headers=admin_headers, json={"student_id": "testmember999", "book_id": book_ids[1]})
        log_result("Settings: Block Borrow on Fine", resp7.status_code == 400 and "unpaid fines" in resp7.text, "Should block borrow due to unpaid fines")
        
        # TEST 6: Fine Payment
        # Fetch fines via API as member
        resp8 = await c.get(f"{base_url}/api/v1/fines", headers=mem_headers)
        fines_data = resp8.json()
        fines_list = fines_data.get("fines", []) if isinstance(fines_data, dict) else fines_data
        
        fine_id = None
        if len(fines_list) > 0 and 'id' in fines_list[0]:
            fine_id = fines_list[0]['id']
            log_result("Fines: API Visibility", True, f"Found fine {fine_id}")
        else:
            log_result("Fines: API Visibility", False, "Could not fetch fines from API")
        
        if fine_id:
            # Pay fine
            resp9 = await c.post(f"{base_url}/api/v1/fines/pay", headers=admin_headers, json={"fine_id": fine_id})
            log_result("Fines: Fine Payment", resp9.status_code == 200, "Payment should succeed")
            
            # Duplicate payment
            resp10 = await c.post(f"{base_url}/api/v1/fines/pay", headers=admin_headers, json={"fine_id": fine_id})
            log_result("Fines: Duplicate Payment", resp10.status_code == 400 and "already been paid" in resp10.text.lower(), "Second payment should fail")
            
            # Borrow should now succeed
            resp11 = await c.post(f"{base_url}/api/v1/borrows/issue", headers=admin_headers, json={"student_id": "testmember999", "book_id": book_ids[1]})
            log_result("Settings: Allow Borrow After Payment", resp11.status_code == 200, "Borrow should succeed after fine cleared")

if __name__ == "__main__":
    asyncio.run(main())
