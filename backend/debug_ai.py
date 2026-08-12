import sys
sys.stdout.reconfigure(encoding='utf-8')
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import security
from app.database import db

client = TestClient(app)

# get DB
pymongo_db = db.get_db()
member_user = pymongo_db.users.find_one({"role": "member"})

if not member_user:
    print("Users not found")
    exit(1)

# Generate a token manually for member
token = security.create_access_token({
    "sub": str(member_user["_id"]),
    "email": member_user.get("email"),
    "role": "member", 
    "full_name": member_user.get("full_name", "Member")
})
headers = {"Authorization": f"Bearer {token}"}

tests = [
    "Find Python books"
]

for test in tests:
    print(f"\n--- Testing Member: {test} ---")
    ai_data = {"message": test, "history": "[]"}
    response = client.post("/api/v1/ai/chat", headers=headers, data=ai_data)
    print(f"Status: {response.status_code}")
    try:
        print("Response:", response.json()['response'])
    except Exception as e:
        print("Raw Response:", response.text)
