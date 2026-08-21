import asyncio
from pymongo import MongoClient
from app.config import settings
from app.core.security import security
from app.main import app
from fastapi.testclient import TestClient

client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]
test_client = TestClient(app)

def get_token(email, pw):
    resp = test_client.post("/api/v1/auth/login", json={"email": email, "password": pw})
    return resp.json().get("access_token")

def chat(token, message):
    headers = {"Authorization": f"Bearer {token}"}
    resp = test_client.post("/api/v1/ai/chat", headers=headers, data={"message": message})
    return resp.text, resp.status_code

def main():
    db.users.delete_many({"email": "admin@library.com"})
    db.users.insert_one({"email": "admin@library.com", "username": "admin", "password": security.hash_password("admin123"), "role": "admin", "is_active": True})
    
    tok = get_token("admin@library.com", "admin123")
    if not tok:
        print("Failed to login")
        return
        
    queries = [
        "how many books do we have?",
        "library ma ketla books che?",
        "library me kitni books hain?",
        "show books under 500",
        "500 ni andar ni books batav",
        "show fiction books",
        "books by Harry Potter author",
        "show available books",
        "how many students?",
        "library ma ketla students che?",
        "show active students",
        "recent students",
        "how many authors?",
        "how many categories?",
        "give me library analytics",
        "show circulation report",
        "student activity report",
        "overdue report",
        "fine report",
        "recommend a sari book",
        "ketla member chhe",
        "available che",
        "kitne log"
    ]
    
    for q in queries:
        resp, status = chat(tok, q)
        print(f"Q: {q}\nSTATUS: {status}\nA: {resp}\n")
        assert status == 200

if __name__ == "__main__":
    main()
