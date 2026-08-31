import json
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user

# Bypass authentication by overriding get_current_user
async def mock_current_user():
    return {"_id": "mock_id", "role": "admin", "permissions": ["reports:view"]}

app.dependency_overrides[get_current_user] = mock_current_user

client = TestClient(app)

endpoints = [
    "/api/v1/enterprise_analytics/overview",
    "/api/v1/enterprise_analytics/circulation",
    "/api/v1/enterprise_analytics/books-analytics",
    "/api/v1/enterprise_analytics/categories",
    "/api/v1/enterprise_analytics/authors",
    "/api/v1/enterprise_analytics/members",
    "/api/v1/enterprise_analytics/behaviour",
    "/api/v1/enterprise_analytics/overdue",
    "/api/v1/enterprise_analytics/fines",
    "/api/v1/enterprise_analytics/inventory",
    "/api/v1/enterprise_analytics/acquisitions",
    "/api/v1/enterprise_analytics/reservations",
    "/api/v1/enterprise_analytics/activity",
    "/api/v1/enterprise_analytics/member-growth",
    "/api/v1/enterprise_analytics/insights"
]

print("Running tests WITH mocked user...")
for ep in endpoints:
    try:
        res = client.get(ep)
        if res.status_code == 500:
            print(f"FAILED 500 {ep}: {res.text}")
        elif res.status_code != 200:
            print(f"FAILED {res.status_code} {ep}: {res.text}")
        else:
            print(f"PASSED {ep}")
    except Exception as e:
        print(f"EXCEPTION {ep}: {str(e)}")
