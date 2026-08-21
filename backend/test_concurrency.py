import asyncio
import httpx
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

def setup_db():
    # Insert test user
    db.users.delete_many({"email": member_email})
    db.users.insert_one({"email": member_email, "username": "testmember999", "password": security.hash_password(member_pw), "role": "member", "is_active": True})
    
    db.students.delete_many({"student_id": "testmember999"})
    db.students.insert_one({"student_id": "testmember999", "email": member_email, "full_name": "Test Member", "course": "Test", "is_active": True})
    
    db.books.delete_many({"title": "Concurrency Book"})
    db.books.delete_many({"isbn": "9999999999"})
    res = db.books.insert_one({
        "title": "Concurrency Book",
        "author": "Tester",
        "isbn": "9999999999",
        "total_copies": 2,
        "available_copies": 2,
        "is_available": True,
        "genre": "Test"
    })
    
    db.borrows.delete_many({"book_id": str(res.inserted_id)})
    return str(res.inserted_id)

async def issue_book(client_session, token, book_id):
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client_session.post(f"{base_url}/api/v1/borrows/issue", headers=headers, json={"student_id": "testmember999", "book_id": book_id})
    return resp.status_code, resp.json()

async def get_token():
    async with httpx.AsyncClient() as client_session:
        resp = await client_session.post(f"{base_url}/api/v1/auth/login", json={"email": admin_email, "password": admin_pw})
        return resp.json().get("access_token")

async def main():
    print("Setting up DB...")
    book_id = setup_db()
    token = await get_token()
    
    print(f"Book ID: {book_id}")
    print("Sending two simultaneous issue requests...")
    
    async with httpx.AsyncClient() as client_session:
        results = await asyncio.gather(
            issue_book(client_session, token, book_id),
            issue_book(client_session, token, book_id)
        )
        
    print("Results:")
    for status, data in results:
        print(f"Status: {status}, Response: {data}")
        
    # Check DB state
    from bson import ObjectId
    book = db.books.find_one({"_id": ObjectId(book_id)})
    borrows = list(db.borrows.find({"book_id": book_id}))
    
    print(f"\nFinal DB State:")
    print(f"Available Copies: {book['available_copies']}")
    print(f"Active Borrows Count: {len(borrows)}")
    
    if len(borrows) == 1 and book['available_copies'] == 1:
        print("\nPASS: Concurrency handled correctly.")
    else:
        print("\nFAIL: Concurrency violated!")

if __name__ == "__main__":
    asyncio.run(main())
