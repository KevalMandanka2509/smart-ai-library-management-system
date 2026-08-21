import sys
import requests
from pymongo import MongoClient
from app.config import settings

base_url = "http://localhost:8000"

def login(email, password):
    resp = requests.post(f"{base_url}/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json().get("access_token")

admin_tok = login("admin@library.com", "TestAdmin@123!")
headers = {"Authorization": f"Bearer {admin_tok}"}

# Create Student
student_data = {
    "student_id": "crudteststudent001",
    "full_name": "CRUD Test Student",
    "email": "crudtest@student.com",
    "course": "BTech",
    "year": 1,
    "contact_number": "1234567890",
    "address": "Test Address",
    "is_active": True
}

results = {}

try:
    c_resp = requests.post(f"{base_url}/api/v1/students", headers=headers, json=student_data)
    if c_resp.status_code in [200, 201]:
        # GET Student
        g_resp = requests.get(f"{base_url}/api/v1/students/crudteststudent001", headers=headers)
        if g_resp.status_code == 200:
            # Update Student
            u_resp = requests.put(f"{base_url}/api/v1/students/crudteststudent001", headers=headers, json={"course": "MTech"})
            if u_resp.status_code == 200:
                # Delete Student
                d_resp = requests.delete(f"{base_url}/api/v1/students/crudteststudent001", headers=headers)
                if d_resp.status_code in [200, 204]:
                    results["Students CRUD"] = "PASS"
                else:
                    results["Students CRUD"] = f"FAIL Delete {d_resp.status_code} {d_resp.text}"
            else:
                results["Students CRUD"] = f"FAIL Update {u_resp.status_code} {u_resp.text}"
        else:
            results["Students CRUD"] = f"FAIL GET {g_resp.status_code} {g_resp.text}"
    else:
        results["Students CRUD"] = f"FAIL Create {c_resp.status_code} {c_resp.text}"
except Exception as e:
    results["Students CRUD"] = f"FAIL {e}"

# Cleanup just in case
client = MongoClient(settings.MONGODB_URL)
db = client[settings.DATABASE_NAME]
db.students.delete_many({"student_id": "crudteststudent001"})

print(results)
