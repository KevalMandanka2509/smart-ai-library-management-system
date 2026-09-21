import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

async def audit():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    db = client.library_db
    
    print("Email | Role | Active/Seed | Valid Bcrypt Hash")
    async for user in db.users.find():
        pwd = user.get('password')
        is_valid = bool(pwd and isinstance(pwd, str) and (pwd.startswith('$2a$') or pwd.startswith('$2b$') or pwd.startswith('$2y$')))
        
        email = user['email']
        role = user.get('role', 'unknown')
        
        # simple heuristic for seed/test accounts based on previous findings
        is_seed_or_test = "test" in email or "example.com" in email or email in ["librarian@library.com", "admin_cce8e9@test.com", "admin@library.com", "admin@smartlibrary.com"]
        if is_seed_or_test:
            acc_type = "test/seed"
        else:
            acc_type = "active/real"
            
        print(f"{email} | {role} | {acc_type} | {is_valid}")

asyncio.run(audit())
