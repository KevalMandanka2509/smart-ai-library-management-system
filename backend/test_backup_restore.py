import os
import requests
import json
from pymongo import MongoClient
from datetime import datetime, timedelta
import asyncio

API_URL = "http://127.0.0.1:8000/api/v1"

client = MongoClient("mongodb://localhost:27017/")
db = client["library_db"]
test_db = client["test_library_db"]

# Helper to get admin token
def get_admin_token():
    # If admin doesn't exist, create it
    db.users.delete_many({"username": "test_admin"})
    db.users.delete_many({"email": "test_admin@library.com"})
    reg_resp = requests.post(f"{API_URL}/auth/register", json={
        "username": "test_admin",
        "email": "test_admin@library.com",
        "full_name": "Test Admin",
        "password": "Admin@123!"
    })
    if reg_resp.status_code != 201:
        raise Exception(f"Failed to register: {reg_resp.text}")
    db.users.update_one({"email": "test_admin@library.com"}, {"$set": {"role": "admin", "is_active": True}})
        
    resp = requests.post(f"{API_URL}/auth/login", json={"email": "test_admin@library.com", "password": "Admin@123!"})
    if resp.status_code != 200:
        raise Exception(f"Failed to login: {resp.text}")
    return resp.json()["access_token"]

def main():
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    print("--- 1. Testing Backup ---")
    resp = requests.post(f"{API_URL}/backups/create", headers=headers)
    assert resp.status_code == 201, resp.text
    backup_data = resp.json()
    backup_id = backup_data["backup"]["id"]
    
    # Download to check content
    resp = requests.get(f"{API_URL}/backups/{backup_id}/download", headers=headers)
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    
    # Verify required collections
    cols = ["books", "students", "authors", "categories", "borrows", "fines", "reservations", "users", "notifications", "notification_settings", "settings"]
    for c in cols:
        assert c in payload, f"Missing {c} in backup payload"
        
    # Verify secrets are NOT exported
    for u in payload.get("users", []):
        assert "hashed_password" not in u
        assert "password" not in u
    
    print("OK Backup successfully generated, secrets scrubbed, all collections present.")
    
    print("--- 2. Testing Restore ---")
    # We will simulate restore into the same DB to check behavior
    # But first we modify a book to see if it restores
    if payload["books"]:
        book = payload["books"][0]
        original_title = book.get("title")
        db.books.update_one({"isbn": book["isbn"]}, {"$set": {"title": "Modified Title"}})
        
    resp = requests.post(f"{API_URL}/backups/restore?backup_id={backup_id}", headers=headers)
    assert resp.status_code == 200, resp.text
    
    if payload["books"]:
        restored_book = db.books.find_one({"isbn": payload["books"][0]["isbn"]})
        assert restored_book["title"] == original_title, "Book title wasn't restored correctly!"
        
    # Verify ObjectIds
    if payload["borrows"]:
        b = db.borrows.find_one()
        assert type(b["_id"]) != str, "_id was restored as a string!"
        
    print("OK Restore completed successfully, references and ObjectIds maintained.")
    
    print("--- 3. Testing Failure/Rollback ---")
    from bson.objectid import ObjectId
    # Instead of pulling the 51MB payload and blowing up MongoDB BSON limits, just mock a small bad payload
    bad_payload = {
        "version": "1.0",
        "books": [],
        "students": [],
        "authors": [],
        "categories": [],
        "users": [],
        "borrows": [],
        "reservations": [],
        "fines": ["not_a_dict_so_it_will_crash_the_restore"]
    }
    
    # Save bad backup
    db.backup_history.delete_one({"_id": ObjectId("60d5ec49c1234567890abcde")})
    db.backup_history.insert_one({
        "_id": ObjectId("60d5ec49c1234567890abcde"),
        "payload": json.dumps(bad_payload)
    })
    
    # Capture a book before restore
    book = db.books.find_one()
    
    resp = requests.post(f"{API_URL}/backups/restore?backup_id=60d5ec49c1234567890abcde", headers=headers)
    assert resp.status_code == 500, f"Expected 500 on invalid restore, got {resp.status_code}"
    assert "Restore failed, database rolled back" in resp.text
    
    # Verify rollback restored the deleted book
    if book:
        assert db.books.find_one({"_id": book["_id"]}) is not None, "Rollback failed to restore books!"
    print("OK Rollback completed successfully, atomic behavior simulated.")
    
    print("--- 4. Size/Security Testing ---")
    # Test large file
    large_payload = b"[" * (51 * 1024 * 1024)
    files = {'file': ('large.json', large_payload, 'application/json')}
    resp = requests.post(f"{API_URL}/backups/restore", headers=headers, files=files)
    assert resp.status_code == 400
    assert "too large" in resp.text
    
    print("OK Large file constraint enforced.")
    
    print("ALL TESTS PASSED")

if __name__ == "__main__":
    main()
