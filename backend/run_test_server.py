import subprocess
import time
import requests
import sys

print("Starting FastAPI server...")
server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"])
time.sleep(5) # wait for startup

try:
    print("Running crud_test.py...")
    # Modify crud_test to point to http://127.0.0.1:8001 instead of TestClient? 
    # Or just write a quick requests-based test
    pass
finally:
    server.terminate()
    print("Server stopped.")
