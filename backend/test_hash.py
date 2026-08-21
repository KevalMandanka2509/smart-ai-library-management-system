import sys
import bcrypt
from app.core.security import security

pw = "TestAdmin@123!"
hashed = security.hash_password(pw)
print("Hash:", hashed)
print("Verify:", security.verify_password(pw, hashed))
print("Verify with manual checkpw:", bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8')))

