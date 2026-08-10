import subprocess
import time
import socket
import urllib.request
import urllib.error
import sys

print("Starting Uvicorn without --reload on port 8001...")
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8001", "--host", "127.0.0.1"],
    cwd="backend"
)

# Wait for startup
print("Waiting 5 seconds for startup...")
time.sleep(5)

endpoints = [
    '/docs',
    '/api/v1/health',
    '/api/v1/books/browse/',
    '/api/v1/authors/'
]

for ep in endpoints:
    url = f"http://127.0.0.1:8001{ep}"
    print(f"\\nTesting GET {url} ...")
    try:
        start = time.time()
        with urllib.request.urlopen(url, timeout=3) as response:
            status = response.status
            body = response.read().decode()
            elapsed = time.time() - start
            print(f"SUCCESS: {status} in {elapsed:.2f}s - {body[:100]}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode()[:100]}")
    except urllib.error.URLError as e:
        if isinstance(e.reason, socket.timeout):
            print(f"TIMEOUT: {e.reason}")
        else:
            print(f"CONNECTION ERROR: {e.reason}")
    except Exception as e:
        print(f"ERROR: {e}")

print("\\nShutting down Uvicorn...")
proc.terminate()
proc.wait(timeout=5)
print("Done.")
