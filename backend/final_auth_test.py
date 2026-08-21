import sys
import requests
from pymongo import MongoClient
from app.config import settings
from app.core.security import security

base_url = "http://localhost:8000"

client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]

admin_email = "admin@library.com"
admin_password = "TestAdmin@123!"

member_email = "testmember999@test.com"
member_password = "TestMember@123!"

# Ensure test member exists
db.users.delete_many({"email": member_email})
db.users.insert_one({
    "email": member_email,
    "username": "testmember999",
    "password": security.hash_password(member_password),
    "role": "member",
    "is_active": True,
})

def do_login(email, password):
    resp = requests.post(f"{base_url}/api/v1/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json().get("access_token")
    print(f"Login fail {email}: {resp.status_code} - {resp.text}")
    return None

admin_token = do_login(admin_email, admin_password)
member_token = do_login(member_email, member_password)

print(f"Admin Token: {'PASS' if admin_token else 'FAIL'}")
print(f"Member Token: {'PASS' if member_token else 'FAIL'}")

# Invalid password
bad_resp = requests.post(f"{base_url}/api/v1/auth/login", json={"email": admin_email, "password": "wrong"})
print(f"Invalid password: {'PASS' if bad_resp.status_code == 401 else 'FAIL'}")

if admin_token:
    me_resp = requests.get(f"{base_url}/api/v1/profile/me", headers={"Authorization": f"Bearer {admin_token}"})
    print(f"/profile/me: {'PASS' if me_resp.status_code == 200 else 'FAIL - ' + str(me_resp.status_code)}")
    
    rbac_resp = requests.get(f"{base_url}/api/v1/reports/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    print(f"Admin RBAC: {'PASS' if rbac_resp.status_code == 200 else 'FAIL - ' + str(rbac_resp.status_code)}")

if member_token:
    rbac_neg = requests.get(f"{base_url}/api/v1/reports/dashboard", headers={"Authorization": f"Bearer {member_token}"})
    print(f"Member RBAC (Negative): {'PASS' if rbac_neg.status_code in [401, 403] else 'FAIL - ' + str(rbac_neg.status_code)}")

# Cleanup
db.users.delete_many({"email": member_email})
