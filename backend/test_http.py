import requests

from app.database import get_db
db = get_db()
admin = db.users.find_one({"role": "admin"})
if not admin:
    print("No admin user found")
    exit()

from app.core.security import Security
token = Security.create_access_token(data={"sub": str(admin["_id"]), "role": "admin"})
headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    "/api/v1/enterprise_analytics/overview",
    "/api/v1/enterprise_analytics/circulation",
    "/api/v1/enterprise_analytics/categories",
    "/api/v1/enterprise_analytics/authors",
    "/api/v1/enterprise_analytics/inventory",
    "/api/v1/enterprise_analytics/acquisitions",
    "/api/v1/enterprise_analytics/activity",
    "/api/v1/enterprise_analytics/member-growth",
    "/api/v1/enterprise_analytics/insights"
]

for ep in endpoints:
    url = f"http://localhost:8000{ep}"
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 500:
            print(f"FAILED 500 {ep}: {res.text}")
        else:
            print(f"PASSED {ep}: {res.status_code}")
    except Exception as e:
        print(f"EXCEPTION {ep}: {str(e)}")
