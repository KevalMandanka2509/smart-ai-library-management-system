# Smart AI Library Management System

## Project Overview
The Smart AI Library Management System is a comprehensive, production-ready full-stack application designed to modernize traditional library operations. It eliminates manual tracking, provides deep analytical insights, strictly manages concurrent workflows (such as issuing limited book copies), and integrates an advanced, multilingual AI Chatbot (powered by Google Gemini) that is natively grounded in the library's live database.

## Features
- **Centralized Catalogue & Members**: Manage Books, Authors, Categories, Students, and Admin/Librarian Users.
- **Workflow Integrity**: Issue/Return and Reservation logic fortified by concurrent locking and strict MongoDB validation to prevent duplicate checking out or negative inventory.
- **Automated Fine Management**: Dynamic penalty calculations for overdue returns and automatic block placement.
- **Advanced Role-Based Access Control (RBAC)**: Strict separation of privileges across Admins, Librarians, and Members.
- **Multilingual AI Chatbot**: A context-aware assistant capable of interpreting natural language queries in English, Gujarati, and Hinglish. It queries the database in real-time, respects member privacy (only pulling their personal records if requested), and provides grounded answers.
- **Enterprise Utilities**: Multi-worker APScheduler for periodic notifications/fines, Secure Backup/Restore APIs (admin only), and Comprehensive Audit Logging.

## Technology Stack
- **Frontend**: React 18, Vite, React Router, TailwindCSS, Axios
- **Backend**: FastAPI (Python 3.14+), Pydantic, APScheduler
- **Database**: MongoDB (PyMongo)
- **AI**: Google GenAI (`gemini-2.5-flash`)
- **Security**: JWT (`jose`), bcrypt (`passlib`), `slowapi` rate limiting

## Prerequisites
- Node.js (v18+)
- Python (3.11 - 3.14)
- MongoDB running instance (Local or Atlas)
- Google Gemini API Key

## Setup Instructions

### Environment Variables
Create a `.env` file in the `backend/` directory:
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=smart_library
SECRET_KEY=<your-secure-jwt-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GEMINI_API_KEY=<your-gemini-key>
```
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### Backend Setup
1. Navigate to the `backend` directory: `cd backend`
2. Create virtual environment: `python -m venv venv`
3. Activate environment: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4. Install dependencies: `pip install -r requirements.txt`
5. Run the server: `uvicorn app.main:app --reload --port 8000`

### Frontend Setup
1. Navigate to the `frontend` directory: `cd frontend`
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Build for production: `npm run build`

## Test Commands
The system includes an extensive regression test suite enforcing concurrency, security, and AI integrity.
Run tests from the `backend/` directory (ensure the backend is running or `MONGODB_URL` is set):
```bash
venv\Scripts\python run_full_smoke_test.py
venv\Scripts\python test_concurrency.py
venv\Scripts\python test_settings_fines.py
venv\Scripts\python test_ai_library_batch1.py
venv\Scripts\python test_ai_semantic_stress.py
venv\Scripts\python test_backup_restore.py
venv\Scripts\python test_auth_security.py
venv\Scripts\python test_upload_security.py
venv\Scripts\python test_scheduler_safety.py
venv\Scripts\python test_database_performance.py
```
For the frontend:
```bash
npm run lint
npm run build
```

## AI Chatbot Setup
The chatbot requires a valid `GEMINI_API_KEY`. It automatically processes user tokens for contextual questions like "what are my fines?". No additional setup is required beyond the API key.

## Default Development Accounts
The system requires an initial Admin account to bootstrap roles. You can create one directly in the DB:
```python
from pymongo import MongoClient; from app.core.security import security
db = MongoClient("mongodb://localhost:27017")["smart_library"]
db.users.update_one({'email': 'admin@library.com'}, {'$set': {'username':'admin', 'password': security.hash_password('TestAdmin@123!'), 'role': 'admin', 'is_active': True}}, upsert=True)
```

## Troubleshooting
- **UnicodeEncodeError (Windows)**: If testing AI scripts in Windows CMD, set `PYTHONIOENCODING=utf8` before running to handle Gujarati/Hinglish characters.
- **401 Unauthorized during Tests**: Ensure the `admin@library.com` account is properly seeded in the `users` collection.
- **Multi-worker APScheduler**: The scheduler utilizes distributed database locks in the `apscheduler_jobs` collection to prevent duplicate jobs across workers. Do not manually clear this collection while the server is active.
