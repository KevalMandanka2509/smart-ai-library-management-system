import urllib.request
import json
import re

with open('d:/smart-ai-library-management-system/smart-ai-library-management-system/diagnostic_auth.py', 'r') as f:
    content = f.read()

match = re.search(r"access_token\s*=\s*'([^']+)'", content)
token = match.group(1) if match else ''

def fetch(url):
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(req) as response:
            print(f'SUCCESS {url}: {response.status}')
    except Exception as e:
        if hasattr(e, 'read'):
            print(f'ERROR {url}: {e.code} {e.read().decode()}')
        else:
            print(f'ERROR {url}: {e}')

fetch('http://localhost:8000/api/v1/students')
fetch('http://localhost:8000/api/v1/borrows/transactions')
fetch('http://localhost:8000/api/v1/analytics/reports?granularity=monthly&period=12')
