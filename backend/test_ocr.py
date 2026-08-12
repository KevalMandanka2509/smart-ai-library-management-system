import sys
import json
import base64
import urllib.request
from app.core.security import security
from app.database import db
from bson.objectid import ObjectId
import uuid

sys.stdout.reconfigure(encoding='utf-8')

pymongo_db = db.get_db()
member_user = pymongo_db.users.find_one({'role': 'member'})
token = security.create_access_token({
    'sub': str(member_user['_id']),
    'email': member_user.get('email'),
    'role': member_user.get('role'),
    'full_name': member_user.get('full_name', 'Test User')
})

def upload_file(filename, message):
    boundary = uuid.uuid4().hex
    body = bytearray()
    
    body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name=\"message\"\r\n\r\n{message}\r\n'.encode('utf-8'))
    body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name=\"history\"\r\n\r\n[]\r\n'.encode('utf-8'))
    
    with open(filename, 'rb') as f:
        file_data = f.read()
    body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: image/png\r\n\r\n'.encode('utf-8'))
    body.extend(file_data)
    body.extend(f'\r\n--{boundary}--\r\n'.encode('utf-8'))
    
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/v1/ai/chat',
        data=body,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': f'multipart/form-data; boundary={boundary}'
        }
    )
    
    full_response = ''
    try:
        with urllib.request.urlopen(req) as response:
            for line in response:
                decoded = line.decode('utf-8')
                full_response += decoded
    except Exception as e:
        full_response = str(e)
    return full_response

print('OCR Valid Response:')
print(upload_file('test_ocr_valid.png', 'What does this document say?'))

print('\nOCR Inject Response:')
print(upload_file('test_ocr_inject.png', 'What does this image say?'))
