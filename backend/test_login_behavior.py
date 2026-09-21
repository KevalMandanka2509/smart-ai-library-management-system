import requests
import pytest

BASE_URL = "http://localhost:8000/api/v1/auth"

def check_login(email, password, expected_status, expected_message_contains=None):
    try:
        res = requests.post(f"{BASE_URL}/login", json={"email": email, "password": password})
    except requests.ConnectionError:
        pytest.skip("Local server not running on port 8000")
        
    assert res.status_code == expected_status, f"Expected {expected_status}, got {res.status_code}. Response: {res.text}"
        
    if expected_message_contains:
        assert expected_message_contains in res.text, f"Expected message to contain '{expected_message_contains}', got '{res.text}'"

def test_login_behavior():
    # Setup isolated test user with no password hash
    from pymongo import MongoClient
    client = MongoClient("mongodb://localhost:27017/")
    db = client["library_db"]
    
    test_user_email = "isolated_test_nopw@example.com"
    db.users.delete_many({"email": test_user_email})
    db.users.insert_one({
        "username": "isolated_test_nopw",
        "email": test_user_email,
        "password_hash": "", # Intentionally blank
        "role": "student",
        "status": "Active",
        "failed_login_attempts": 0,
        "locked_until": None
    })
    
    try:
        # A) User with a valid existing password
        check_login("admin@library.com", "TestAdmin@123!", 200)
    
        # B) User with no password hash (we reverted their password)
        check_login(test_user_email, "Anything", 401, "Invalid email or password")
    finally:
        # Cleanup
        db.users.delete_many({"email": test_user_email})

    # C) Wrong password
    check_login("admin@library.com", "WrongPassword!123", 401, "Invalid email or password")

    # D) Nonexistent user
    check_login("doesnotexist@example.com", "Password", 401, "Invalid email or password")

