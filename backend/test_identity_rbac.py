import asyncio
import httpx
from pymongo import MongoClient
from app.config import settings
from app.core.security import security
from bson import ObjectId
import json

base_url = "http://localhost:8000"
client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

admin_email = "admin@library.com"
admin_pw = "TestAdmin@123!"
member_email = "testidentity999@test.com"
member_pw = "TestMember@123!"
member_id = "testidentity999"

results = []

def log_result(test_name, passed, msg=""):
    results.append((test_name, passed, msg))
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {test_name}: {msg}")

def setup_db():
    db.users.delete_many({"email": member_email})
    db.users.insert_one({"email": member_email, "username": member_id, "password": security.hash_password(member_pw), "role": "member", "is_active": True})
    
    db.students.delete_many({"student_id": member_id})
    db.students.delete_many({"student_id": "testidentity999_updated"})
    student_res = db.students.insert_one({"student_id": member_id, "email": member_email, "full_name": "Test Identity", "course": "Test", "is_active": True})
    
    db.authors.delete_many({"name": "Test Author Identity"})
    db.authors.delete_many({"name": "Test Author Identity Updated"})
    db.categories.delete_many({"name": "Test Category Identity"})
    db.categories.delete_many({"name": "Test Category Identity Updated"})
    
    db.authors.insert_one({"name": "Test Author Identity", "status": "active"})
    db.categories.insert_one({"name": "Test Category Identity", "status": "active"})
    
    db.books.delete_many({"genre": {"$regex": "Test Category"}})
    db.borrows.delete_many({"student_id": {"$regex": "testidentity"}})
    db.fines.delete_many({"student_id": {"$regex": "testidentity"}})
    db.reservations.delete_many({"student_id": {"$regex": "testidentity"}})
    
    res = db.books.insert_one({
        "title": "Identity Book",
        "author": "Test Author Identity",
        "isbn": "1231231231",
        "total_copies": 2,
        "available_copies": 1,
        "is_available": True,
        "genre": "Test Category Identity"
    })
    
    # Create borrow
    db.borrows.insert_one({
        "student_id": member_id,
        "book_id": str(res.inserted_id),
        "status": "issued"
    })
    
    # Create reservation
    db.reservations.insert_one({
        "student_id": member_id,
        "book_id": str(res.inserted_id),
        "status": "pending"
    })
    
    # Create fine
    db.fines.insert_one({
        "student_id": member_id,
        "amount": 10.0,
        "paid": False
    })
    
    return str(student_res.inserted_id)

async def get_token(email, pw):
    async with httpx.AsyncClient() as c:
        resp = await c.post(f"{base_url}/api/v1/auth/login", json={"email": email, "password": pw})
        return resp.json().get("access_token")

async def main():
    student_obj_id = setup_db()
    admin_tok = await get_token(admin_email, admin_pw)
    mem_tok = await get_token(member_email, member_pw)
    
    admin_headers = {"Authorization": f"Bearer {admin_tok}"}
    mem_headers = {"Authorization": f"Bearer {mem_tok}"}
    
    async with httpx.AsyncClient() as c:
        # A. Identity - Change student ID
        new_id = "testidentity999_updated"
        resp = await c.put(f"{base_url}/api/v1/students/{student_obj_id}", headers=admin_headers, json={"student_id": new_id})
        log_result("Identity: Change Student ID", resp.status_code == 200, f"Expected 200, got {resp.status_code}")
        
        # Verify Borrows, Reservations, Fines, Users cascaded
        b_count = db.borrows.count_documents({"student_id": new_id})
        r_count = db.reservations.count_documents({"student_id": new_id})
        f_count = db.fines.count_documents({"student_id": new_id})
        u_count = db.users.count_documents({"username": new_id})
        
        log_result("Identity: Cascade Borrows", b_count == 1, f"Expected 1 borrow, got {b_count}")
        log_result("Identity: Cascade Reservations", r_count == 1, f"Expected 1 reservation, got {r_count}")
        log_result("Identity: Cascade Fines", f_count == 1, f"Expected 1 fine, got {f_count}")
        log_result("Identity: Cascade User Account", u_count == 1, f"Expected 1 user, got {u_count}")
        
        # Identity - Member login with old username should fail, new should succeed
        old_login = await c.post(f"{base_url}/api/v1/auth/login", json={"email": member_email, "password": member_pw})
        log_result("Identity: Login works with new student ID linked email", old_login.status_code == 200, "Login via email")
        
        # Delete student
        resp_del = await c.delete(f"{base_url}/api/v1/students/{student_obj_id}", headers=admin_headers)
        # Should fail because of active borrows
        log_result("Identity: Delete Student w/ active borrows", resp_del.status_code == 400, "Should be blocked")
        
        # B. Author/Category Cascade
        author_db = db.authors.find_one({"name": "Test Author Identity"})
        resp_author = await c.put(f"{base_url}/api/v1/authors/{author_db['_id']}", headers=admin_headers, json={"name": "Test Author Identity Updated"})
        cat_db = db.categories.find_one({"name": "Test Category Identity"})
        resp_cat = await c.put(f"{base_url}/api/v1/categories/{cat_db['_id']}", headers=admin_headers, json={"name": "Test Category Identity Updated"})
        
        book_db = db.books.find_one({"title": "Identity Book"})
        log_result("Cascade: Author Rename", book_db.get("author") == "Test Author Identity Updated", f"Got author: {book_db.get('author')}")
        log_result("Cascade: Category Rename", book_db.get("genre") == "Test Category Identity Updated", f"Got category: {book_db.get('genre')}")
        
        # Delete Author
        resp_del_author = await c.delete(f"{base_url}/api/v1/authors/{author_db['_id']}", headers=admin_headers)
        log_result("Cascade: Delete Author w/ Books", resp_del_author.status_code == 400, "Should block author delete")
        
        # C. RBAC
        # 1. Unauthenticated
        resp_unauth = await c.get(f"{base_url}/api/v1/books")
        log_result("RBAC: Unauthenticated GET Books", resp_unauth.status_code == 401, f"Got {resp_unauth.status_code}")
        
        # 2. Member trying to write book
        resp_mem_write = await c.post(f"{base_url}/api/v1/books/", headers=mem_headers, json={"title": "Test", "isbn": "222", "author": "A", "total_copies": 1})
        log_result("RBAC: Member Write Books", resp_mem_write.status_code == 403, f"Got {resp_mem_write.status_code}")
        
        # 3. Member trying to view students (requires students:manage)
        resp_mem_student = await c.get(f"{base_url}/api/v1/students", headers=mem_headers)
        log_result("RBAC: Member View All Students", resp_mem_student.status_code == 403, f"Got {resp_mem_student.status_code}")
        
        # 4. Member trying to view their own profile (requires profile:read) -> should succeed
        resp_mem_prof = await c.get(f"{base_url}/api/v1/students/{new_id}", headers=mem_headers)
        log_result("RBAC: Member View Own Profile", resp_mem_prof.status_code == 200, f"Got {resp_mem_prof.status_code}")
        
        # 5. Member trying to view settings (should succeed but omit sensitive info, so we test PUT instead)
        resp_mem_settings = await c.put(f"{base_url}/api/v1/settings/", headers=mem_headers, json={"library": {}})
        log_result("RBAC: Member Modify Settings", resp_mem_settings.status_code == 403, f"Got {resp_mem_settings.status_code}")

if __name__ == "__main__":
    asyncio.run(main())
