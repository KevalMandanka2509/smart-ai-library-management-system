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
    tok = get_token("admin@library.com", "admin123")
    if not tok:
        print("Failed to login")
        return
        
    queries = [
        "bhai apdi library ma total ketli books padi che?",
        "library me abhi kitni kitab available hain?",
        "500 rupiya karta ochhi price ni badhi books batav",
        "which books can I actually borrow right now?",
        "ena author e biji kai books lakhi che?",
        "mara account ma atyare shu pending che?"
    ]
    
    # Just run them to ensure 200 OK.
    # The actual semantic mapping would require a live Gemini LLM or advanced Spacy NLP.
    # Since we are using fallback, some might hit UNKNOWN or generic BOOK_SEARCH, but it should not 500.
    for q in queries:
        resp, status = chat(tok, q)
        print(f"Q: {q}\nSTATUS: {status}\nA: {resp}\n")
        assert status == 200

if __name__ == "__main__":
    main()
