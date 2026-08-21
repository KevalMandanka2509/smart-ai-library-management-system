import os
import json
import time
from pymongo import MongoClient
import requests
import asyncio
from datetime import datetime, timedelta

os.environ["JWT_SECRET_KEY"] = "test_secret_key"
os.environ["SMTP_HOST"] = "localhost" # So it acts as "simulated"
os.environ["SMS_PROVIDER"] = "mock"

client = MongoClient("mongodb://localhost:27017/")
db = client["library_db"]
API_URL = "http://localhost:8000/api/v1"

def get_admin_credentials():
    return "admin@library.com", "TestAdmin@123!"

def setup_test_data():
    db.users.delete_many({"username": "testnotifuser"})
    db.students.delete_many({"student_id": "testnotifuser"})
    db.books.delete_many({"title": "Test Notif Book"})
    db.borrows.delete_many({"student_id": "testnotifuser"})
    db.reservations.delete_many({"student_id": "testnotifuser"})
    db.fines.delete_many({"student_id": "testnotifuser"})
    db.email_logs.delete_many({"recipient_email": "testnotif@example.com"})
    db.sms_logs.delete_many({"phone": "9998887776"})
    db.notifications.delete_many({"student_id": "testnotifuser"})
    db.notification_settings.delete_many({"username": "testnotifuser"})
    
    # Create test student
    db.students.insert_one({
        "student_id": "testnotifuser",
        "full_name": "Test Notif User",
        "email": "testnotif@example.com",
        "phone": "9998887776",
        "course": "Testing",
        "status": "Active"
    })
    db.books.delete_many({"title": "Test Notif Book"})
    b_id = db.books.insert_one({
        "title": "Test Notif Book", 
        "author": "Tester",
        "isbn": "11111111111",
        "total_copies": 2, 
        "available_copies": 2, 
        "is_available": True
    }).inserted_id
    
    return str(b_id)

def get_token(email, password):
    resp = requests.post(f"{API_URL}/auth/login", json={"email": email, "password": password})
    if "access_token" not in resp.json():
        raise Exception(f"Login failed: {resp.text}")
    return resp.json()["access_token"]

def set_prefs(email_enabled, sms_enabled, issue_alerts, fine_alerts, due_reminders, reservations):
    db.notification_settings.update_one(
        {"username": "testnotifuser"},
        {"$set": {
            "browser_enabled": True,
            "email_enabled": email_enabled,
            "sms_enabled": sms_enabled,
            "types": {
                "issue_alerts": issue_alerts,
                "fine_alerts": fine_alerts,
                "due_reminders": due_reminders,
                "reservations": reservations
            }
        }},
        upsert=True
    )

def test_workflow(book_id, admin_token, expect_email, expect_sms):
    # Clear logs
    db.email_logs.delete_many({"recipient_email": "testnotif@example.com"})
    db.sms_logs.delete_many({"phone": "9998887776"})
    
    # 1. Borrow book
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.post(f"{API_URL}/borrows/issue", json={"book_id": book_id, "student_id": "testnotifuser"}, headers=headers)
    assert resp.status_code == 200, resp.text
    
    time.sleep(0.5) # Wait for async task
    
    email_count = db.email_logs.count_documents({"recipient_email": "testnotif@example.com", "template_name": "issue_confirmation"})
    sms_count = db.sms_logs.count_documents({"phone": "9998887776", "template_name": "issue_confirmation"})
    
    # 2. Return book
    resp = requests.post(f"{API_URL}/borrows/return", json={"book_id": book_id, "student_id": "testnotifuser"}, headers=headers)
    assert resp.status_code == 200, resp.text
    
    time.sleep(0.5)
    
    email_return = db.email_logs.count_documents({"recipient_email": "testnotif@example.com", "template_name": "return_confirmation"})
    sms_return = db.sms_logs.count_documents({"phone": "9998887776", "template_name": "return_confirmation"})
    
    if expect_email:
        assert email_count == 1, "Expected email for issue, got none"
        assert email_return == 1, "Expected email for return, got none"
    else:
        assert email_count == 0, "Expected NO email for issue, got one"
        assert email_return == 0, "Expected NO email for return, got one"
        
    if expect_sms:
        assert sms_count == 1, "Expected SMS for issue, got none"
        assert sms_return == 1, "Expected SMS for return, got none"
    else:
        assert sms_count == 0, "Expected NO SMS for issue, got one"
        assert sms_return == 0, "Expected NO SMS for return, got one"
        
    # Verify status is correctly set to "simulated"
    if expect_email:
        log = db.email_logs.find_one({"recipient_email": "testnotif@example.com", "template_name": "issue_confirmation"})
        assert log["status"] == "simulated", f"Expected email status 'simulated', got {log['status']}"

def main():
    book_id = setup_test_data()
    admin_email, admin_pw = get_admin_credentials()
    admin_token = get_token(admin_email, admin_pw)
    
    print("Testing Workflow 1: All OFF")
    set_prefs(False, False, False, False, False, False)
    test_workflow(book_id, admin_token, False, False)
    print("OK Pass")
    
    print("Testing Workflow 2: All ON")
    set_prefs(True, True, True, True, True, True)
    test_workflow(book_id, admin_token, True, True)
    print("OK Pass")
    
    print("Testing Workflow 3: Email ON, SMS OFF")
    set_prefs(True, False, True, True, True, True)
    test_workflow(book_id, admin_token, True, False)
    print("OK Pass")
    
    print("Testing Workflow 4: Channels ON, Category OFF (issue_alerts=False)")
    set_prefs(True, True, False, True, True, True)
    test_workflow(book_id, admin_token, False, False) # because issue_alerts governs both email and sms for issue/return
    print("OK Pass")
    
    print("All notification tests passed.")

if __name__ == "__main__":
    main()
