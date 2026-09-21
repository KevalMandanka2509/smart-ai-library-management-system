import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_users():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    db = client.library_db
    user = await db.users.find_one({})
    if user:
        print("Keys for a user:", list(user.keys()))
        print("Full user without _id:", {k: v for k, v in user.items() if k != '_id'})
    else:
        print("No users found")

asyncio.run(check_users())
