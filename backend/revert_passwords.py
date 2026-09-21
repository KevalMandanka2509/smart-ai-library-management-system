import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

TARGET_EMAILS = [
    "teststudent@example.com",
    "admin@smartlibrary.com",
    "member1@example.com",
    "approve-test@example.com",
    "admin_cce8e9@test.com",
    "admin_5bd21e@test.com",
    "admin_248d91@test.com",
    "admin_c1c6e6@test.com",
    "admin_45b0c4@test.com",
    "admin_db94e6@test.com",
    "admin_8dfc38@test.com",
    "admin_71f4fd@test.com",
    "admin_fc5921@test.com",
    "admin_68ecad@test.com",
    "admin_a2ba7f@test.com",
    "admin_ad626c@test.com",
    "pfmafhau@test.com",
    "gvisceyz@test.com",
    "testidentity999@test.com",
    "librarian@library.com",
    "test_admin@library.com",
    "kevalmandanka46666@gmail.com",
    "admin2@library.com",
    "kevalhkdigiverse@gmail.com",
    "clipcortex90@gmail.com",
    "frameforge073@gmail.com"
]

async def revert_passwords():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    db = client.library_db
    
    count = 0
    unexpected_count = 0
    
    async for user in db.users.find():
        email = user.get('email')
        if email in TARGET_EMAILS:
            pwd = user.get('password')
            if pwd and isinstance(pwd, str) and (pwd.startswith('$2a$') or pwd.startswith('$2b$') or pwd.startswith('$2y$')):
                # Verify it's actually the temporary password 'Admin@123'
                try:
                    if bcrypt.checkpw(b'Admin@123', pwd.encode('utf-8')):
                        # Unset it safely
                        await db.users.update_one(
                            {'_id': user['_id']},
                            {'$unset': {'password': ''}}
                        )
                        count += 1
                        print(f"Reverted password for: {email}")
                    else:
                        print(f"WARNING: User {email} is in target list but password is not Admin@123")
                        unexpected_count += 1
                except Exception as e:
                    print(f"WARNING: Exception for {email} - {e}")
                    unexpected_count += 1
            else:
                print(f"WARNING: User {email} has missing/invalid hash: {pwd}")
                unexpected_count += 1
    
    print(f"\nReversed {count} expected records. Unexpected: {unexpected_count}")

asyncio.run(revert_passwords())
