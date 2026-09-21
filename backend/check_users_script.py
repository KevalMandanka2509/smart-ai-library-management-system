import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_users():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    db = client.library_db
    
    print("--- Checking all users ---")
    async for user in db.users.find({}):
        email = user.get('email')
        role = user.get('role')
        
        has_password = 'password' in user
        has_hashed = 'hashed_password' in user
        
        if not has_password and not has_hashed:
            print(f"{email} ({role}): NO PASSWORD OR HASHED_PASSWORD FIELD")
        elif has_hashed and not has_password:
            print(f"{email} ({role}): HAS hashed_password BUT NOT password")
            
            pwd = user.get('hashed_password')
            if isinstance(pwd, str) and (pwd.startswith('$2a$') or pwd.startswith('$2b$') or pwd.startswith('$2y$')):
                print(f"  -> Valid bcrypt format")
            else:
                print(f"  -> Invalid format: {pwd[:10]}...")
        else:
            # has password
            pwd = user.get('password')
            if isinstance(pwd, str) and (pwd.startswith('$2a$') or pwd.startswith('$2b$') or pwd.startswith('$2y$')):
                pass # valid, ignore
            else:
                print(f"{email} ({role}): password is invalid type or format")

asyncio.run(check_users())
