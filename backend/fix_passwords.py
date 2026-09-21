import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

async def fix_passwords():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    db = client.library_db
    
    hashed = bcrypt.hashpw(b'Admin@123', bcrypt.gensalt(rounds=12)).decode('utf-8')
    
    count = 0
    async for user in db.users.find({}):
        email = user.get('email')
        
        has_password = 'password' in user
        has_hashed = 'hashed_password' in user
        
        if not has_password and not has_hashed:
            await db.users.update_one(
                {'_id': user['_id']},
                {'$set': {'password': hashed, 'login_attempts': 0}, '$unset': {'locked_until': ''}}
            )
            count += 1
            print(f"Set default password for {email}")

    print(f"Fixed {count} users.")

asyncio.run(fix_passwords())
