from datetime import timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from pymongo import MongoClient
import os
import time

# Create a test DB and override get_db dependency
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
db_client = MongoClient(mongo_uri)
test_db = db_client["test_smart_library"]

def override_get_db():
    try:
        yield test_db
    finally:
        pass

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_otp_rate_limiting():
    # Clean up
    test_db.users.delete_many({"email": "throttle@test.com"})
    test_db.auth_rate_limits.delete_many({"email": "throttle@test.com"})
    
    # Create test user
    test_db.users.insert_one({"email": "throttle@test.com", "is_active": True})
    
    # Request 1 (Success)
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "throttle@test.com"})
    assert resp.status_code == 200
    
    # Request 2 immediately (Should be throttled)
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "throttle@test.com"})
    assert resp.status_code == 429

def test_otp_verification_limits():
    # Clean up
    test_db.users.delete_many({"email": "verify@test.com"})
    test_db.auth_rate_limits.delete_many({"email": "verify@test.com"})
    
    # Create test user
    test_db.users.insert_one({"email": "verify@test.com", "is_active": True})
    
    # Generate OTP (bypass endpoint to insert directly)
    from app.core.security import security
    from datetime import datetime, timedelta
    test_db.auth_rate_limits.insert_one({
        "email": "verify@test.com",
        "type": "otp",
        "otp_hash": security.hash_password("123456"),
        "expires_at": datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10),
        "attempts": 0,
        "cooldown_until": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1)
    })
    
    # Attempt 1 - fail
    resp = client.post("/api/v1/auth/verify-otp", json={"email": "verify@test.com", "otp": "000000"})
    assert resp.status_code == 400
    
    # Attempt 4 more times
    for _ in range(4):
        resp = client.post("/api/v1/auth/verify-otp", json={"email": "verify@test.com", "otp": "000000"})
    
    # At this point attempts = 5
    resp = client.post("/api/v1/auth/verify-otp", json={"email": "verify@test.com", "otp": "000000"})
    assert resp.status_code == 429
    
    # Then even with correct OTP, it should fail
    resp = client.post("/api/v1/auth/verify-otp", json={"email": "verify@test.com", "otp": "123456"})
    assert resp.status_code == 429

if __name__ == "__main__":
    pytest.main(["-v", __file__])
