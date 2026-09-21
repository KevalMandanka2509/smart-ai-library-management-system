import requests
import urllib.parse

BASE_URL = "http://localhost:8000/api/v1"
admin_email = "admin@library.com"
admin_pw = "TestAdmin@123!"

results = {}

# 1. Login
try:
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": admin_email, "password": admin_pw})
    if res.status_code == 200:
        token = res.json().get("access_token")
        results["Login"] = "PASS"
    else:
        results["Login"] = f"FAIL {res.status_code}"
        token = None
except Exception as e:
    results["Login"] = f"FAIL {e}"
    token = None

headers = {"Authorization": f"Bearer {token}"} if token else {}

# Invalid login
try:
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": admin_email, "password": "wrong"})
    if res.status_code == 401:
        results["Invalid Login"] = "PASS (401)"
    else:
        results["Invalid Login"] = f"FAIL {res.status_code}"
except Exception as e:
    results["Invalid Login"] = f"FAIL {e}"

# Dashboard
try:
    res = requests.get(f"{BASE_URL}/analytics/dashboard", headers=headers)
    if res.status_code == 200:
        results["Dashboard"] = "PASS"
    else:
        results["Dashboard"] = f"FAIL {res.status_code}"
except Exception as e:
    results["Dashboard"] = f"FAIL {e}"

# Book Create
book_id = None
try:
    res = requests.post(f"{BASE_URL}/books", headers=headers, json={
        "title": "Runtime Test Book", "author": "Tester", "isbn": "RUNTIME123", "total_copies": 2, "available_copies": 2, "category": "Test"
    })
    if res.status_code in [200, 201]:
        book_id = res.json().get("id") or str(res.json().get("_id"))
        results["Book Create"] = "PASS"
    else:
        results["Book Create"] = f"FAIL {res.status_code} {res.text}"
except Exception as e:
    results["Book Create"] = f"FAIL {e}"

# Book Delete
try:
    if book_id and str(book_id) != "None":
        res = requests.delete(f"{BASE_URL}/books/{book_id}", headers=headers)
        if res.status_code in [200, 204]:
            results["Book Delete"] = "PASS"
        else:
            results["Book Delete"] = f"FAIL {res.status_code}"
    else:
        results["Book Delete"] = "SKIPPED (no book_id)"
except Exception as e:
    results["Book Delete"] = f"FAIL {e}"

# AI Chat
try:
    import json
    files = {
        'message': (None, 'Hello AI'),
        'history': (None, json.dumps([]))
    }
    res = requests.post(f"{BASE_URL}/ai/chat", headers=headers, files=files)
    if res.status_code == 200:
        results["AI Chat"] = "PASS"
    else:
        results["AI Chat"] = f"FAIL {res.status_code} {res.text}"
except Exception as e:
    results["AI Chat"] = f"FAIL {e}"

# Report export
try:
    res = requests.get(f"{BASE_URL}/enterprise_analytics/export-all?period=last_30_days", headers=headers)
    if res.status_code == 200:
        results["Report Export"] = "PASS"
    else:
        results["Report Export"] = f"FAIL {res.status_code} {res.text}"
except Exception as e:
    results["Report Export"] = f"FAIL {e}"

# 9 detailed reports
reports = [
    "Circulation Report", "Book Report", "Member Report", 
    "Overdue Report", "Fine Report", "Reservation Report", 
    "Inventory Report", "Acquisition Report", "Activity Report"
]
all_rep_pass = True
try:
    for r in reports:
        q = urllib.parse.quote(r)
        res = requests.get(f"{BASE_URL}/enterprise_analytics/detailed-report?type={q}&period=last_30_days", headers=headers)
        if res.status_code != 200:
            all_rep_pass = False
            results["9 detailed reports"] = f"FAIL on {r} - {res.status_code}"
            break
    if all_rep_pass:
        results["9 detailed reports"] = "PASS"
except Exception as e:
    results["9 detailed reports"] = f"FAIL {e}"

for k, v in results.items():
    print(f"{k}: {v}")
