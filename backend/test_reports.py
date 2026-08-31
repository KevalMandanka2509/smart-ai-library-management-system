import requests
import urllib.parse

BASE_URL = "http://localhost:8000/api/v1/enterprise_analytics"
# Using a token for auth if needed (assuming user might need it, but the endpoints in enterprise_analytics seem to use current_user which checks token)
# Wait, let's login first to get a token.

def get_token():
    res = requests.post("http://localhost:8000/api/v1/auth/login", data={"username": "admin", "password": "password"}) # default credentials if applicable
    if res.status_code == 200:
        return res.json().get("access_token")
    return None

def test_filters():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    if not token:
        print("Could not get token, assuming endpoints might fail Auth, but will try anyway...")
    
    reports = [
        "Circulation Report", "Book Report", "Member Report", 
        "Overdue Report", "Fine Report", "Reservation Report", 
        "Inventory Report", "Acquisition Report", "Activity Report"
    ]
    
    # 1. No Filters
    print("Testing No Filters...")
    res = requests.get(f"{BASE_URL}/export-all?period=last_30_days", headers=headers)
    if res.status_code == 200:
        print("export-all OK")
    else:
        print("export-all FAILED:", res.text)
        
    for r in reports:
        q = urllib.parse.quote(r)
        res = requests.get(f"{BASE_URL}/detailed-report?type={q}&period=last_30_days", headers=headers)
        if res.status_code == 200:
            print(f"[{r}] OK (records: {len(res.json())})")
        else:
            print(f"[{r}] FAILED:", res.text)
            
    # 2. With Filters
    print("\nTesting With Filters (category=Fiction, status=issued)...")
    filter_params = "period=last_30_days&category=Fiction&status=issued"
    res = requests.get(f"{BASE_URL}/export-all?{filter_params}", headers=headers)
    if res.status_code == 200:
        print("export-all (filtered) OK")
    else:
        print("export-all (filtered) FAILED:", res.text)
        
    for r in reports:
        q = urllib.parse.quote(r)
        res = requests.get(f"{BASE_URL}/detailed-report?type={q}&{filter_params}", headers=headers)
        if res.status_code == 200:
            print(f"[{r}] Filtered OK (records: {len(res.json())})")
        else:
            print(f"[{r}] Filtered FAILED:", res.text)

if __name__ == "__main__":
    test_filters()
