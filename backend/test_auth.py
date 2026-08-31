import requests

res = requests.post('http://127.0.0.1:8000/api/v1/auth/login', json={'email': 'admin@library.com', 'password': 'Admin@123'})
print(f"Login Status: {res.status_code}")
if res.status_code == 200:
    token = res.json().get('access_token')
    headers = {'Authorization': f'Bearer {token}'}
    print("Profile:", requests.get('http://127.0.0.1:8000/api/v1/profile/me', headers=headers).status_code)
    print("Dashboard:", requests.get('http://127.0.0.1:8000/api/v1/analytics/dashboard', headers=headers).status_code)
    print("Categories:", requests.get('http://127.0.0.1:8000/api/v1/enterprise_analytics/categories?period=all_time', headers=headers).status_code)
else:
    print("Login Response:", res.json())
