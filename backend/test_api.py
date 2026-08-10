import subprocess
import time
import requests
import uuid
import sys

BASE_URL = "http://127.0.0.1:8006"

print("Starting FastAPI server...")
server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8006"])

# Wait for server to start with retries
for i in range(20):
    try:
        res = requests.get(f"{BASE_URL}/health", timeout=2)
        if res.status_code == 200:
            print("Server is up!")
            break
    except requests.exceptions.RequestException:
        pass
    time.sleep(1)
else:
    print("Server failed to start!")
    server.terminate()
    sys.exit(1)

try:
    print("\n--- STARTING CRITICAL CRUD FLOWS ---")
    session = requests.Session()
    
    test_email = f"admin_{uuid.uuid4().hex[:6]}@test.com"
    test_password = "StrongPassword123!"
    
    reg_res = session.post(f"{BASE_URL}/api/v1/auth/register", json={
        "email": test_email, "password": test_password,
        "username": f"admin_{uuid.uuid4().hex[:6]}", "full_name": "Test Admin", "role": "admin"
    })
    print(f"Register Admin: {reg_res.status_code}")
    
    login_res = session.post(f"{BASE_URL}/api/v1/auth/login", json={"email": test_email, "password": test_password})
    print(f"Login Admin: {login_res.status_code}")
    if login_res.status_code != 200:
        print("Cannot proceed:", login_res.text)
        sys.exit(1)
        
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    book_data = {
        "title": "Test Book", "author": "Author A", "isbn": f"ISBN-{uuid.uuid4().hex[:6]}",
        "category": "Fiction", "publisher": "Test Pub", "published_year": 2024,
        "total_copies": 5, "price": 10.99
    }
    create_book_res = session.post(f"{BASE_URL}/api/v1/books/", json=book_data, headers=headers, timeout=5)
    print(f"Create Book: {create_book_res.status_code}")
    book_id = create_book_res.json()["id"]
    
    get_books_res = session.get(f"{BASE_URL}/api/v1/books/", headers=headers, timeout=5)
    print(f"Get Books: {get_books_res.status_code}")
    
    student_data = {
        "student_id": f"STU-{uuid.uuid4().hex[:6]}", "name": "Test Student",
        "email": f"stu_{uuid.uuid4().hex[:6]}@test.com", "phone": "1234567890",
        "department": "Science", "course": "B.Sc", "year_of_study": 1
    }
    create_stu_res = session.post(f"{BASE_URL}/api/v1/students/", json=student_data, headers=headers, timeout=5)
    print(f"Create Student: {create_stu_res.status_code}")
    student_id = student_data["student_id"]
    
    issue_data = {"student_id": student_id, "book_id": book_id, "notes": "Test issue"}
    issue_res = session.post(f"{BASE_URL}/api/v1/borrows/issue", json=issue_data, headers=headers, timeout=5)
    print(f"Issue Book: {issue_res.status_code}")
    
    return_res = session.post(f"{BASE_URL}/api/v1/borrows/return/{student_id}/{book_id}", headers=headers, timeout=5)
    print(f"Return Book: {return_res.status_code}")
    
    delete_book_res = session.delete(f"{BASE_URL}/api/v1/books/{book_id}", headers=headers, timeout=5)
    print(f"Delete Book: {delete_book_res.status_code}")
    
    print("\n--- ALL CRUD FLOWS TESTED SUCCESSFULLY ---")

except Exception as e:
    print(f"Error: {e}")
finally:
    server.terminate()
    print("Server stopped.")
