import httpx
import json

BASE = "http://127.0.0.1:8000/api/v1"
ADMIN_EMAIL = "admin@library.com"
ADMIN_PASSWORD = "TestAdmin@123!"
LIBRARIAN_EMAIL = "library.test.librarian01@example.com"
TEST_PASSWORD = "QaTest@2026!"

client = httpx.Client(timeout=10)

def hdr(token):
    return {"Authorization": f"Bearer {token}"}

# Admin login to get tokens
r = client.post(f"{BASE}/auth/login", json={"email": LIBRARIAN_EMAIL, "password": TEST_PASSWORD})
if r.status_code == 200:
    lib_token = r.json()["access_token"]
    print("Librarian logged in successfully.")
    
    r2 = client.get(f"{BASE}/borrows/transactions", headers=hdr(lib_token))
    print("Librarian transactions access:", r2.status_code)
    
    r3 = client.get(f"{BASE}/students", headers=hdr(lib_token))
    print("Librarian students list access:", r3.status_code)
    
    r4 = client.get(f"{BASE}/admin/users", headers=hdr(lib_token))
    print("Librarian admin users access (should be 403):", r4.status_code)
else:
    print("Librarian login failed:", r.status_code, r.text)

