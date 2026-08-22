# Testing Overview

The Smart AI Library Management System is verified using a rigorous suite of automated integration and unit tests covering AI semantic understanding, concurrent system integrity, security, and database boundaries.

## Automated Test Suite
The following Python `pytest` and `httpx` integration scripts are implemented in the `backend/` directory and have consistently passed:

1. `test_ai_security.py`: Verifies that prompt injection attacks against the AI Chatbot fail and that users cannot extract unauthorized secrets.
2. `test_ai_recommendation.py`: Validates the generative recommendation capabilities of the AI pipeline based on user query context.
3. `test_ai_library_batch1.py`: Confirms basic English intent parsing (e.g., querying available books).
4. `test_ai_semantic_stress.py`: Evaluates the multilingual capabilities of the AI Chatbot by testing Gujarati and Hinglish queries against the Semantic Router.
5. `test_concurrency.py`: Stresses the `borrows/issue` endpoint with simultaneous identical requests to ensure MongoDB native `$set` optimistic locking prevents duplicate checkouts of a single book copy.
6. `test_settings_fines.py`: Simulates advancing time to verify that fines generate correctly when overdue, and that the account blocking limits operate correctly when a user surpasses the maximum threshold.
7. `test_backup_restore.py`: Validates that the `/api/v1/backup/create` generates a valid JSON file and that `/api/v1/backup/restore` gracefully repopulates relations (ObjectIds) or fails cleanly if the file is invalid.
8. `test_auth_security.py`: Tests JWT Bearer token generation, expiration logic, and brute-force protections.
9. `test_scheduler_safety.py`: Validates the APScheduler MongoDB distributed lock system to ensure multiple background workers do not duplicate jobs (like sending notifications).
10. `test_upload_security.py`: Enforces strict Magic-Byte validation to ensure simulated file uploads (e.g., CSV imports, images) reject malicious payloads masking as valid extensions.
11. `test_database_performance.py`: Verifies idempotent collection indexing.
12. `run_full_smoke_test.py`: A comprehensive integration pipeline testing complete HTTP flows across Books CRUD, Reports, Borrow/Return, Reservations, Fines, Notifications, and Librarian RBAC logic.

## Frontend Testing
- **Linting**: Executed via `npm run lint`. The repository passes React Hooks dependencies and ESLint configurations seamlessly.
- **Build Verification**: Executed via `npm run build`. The Vite bundler successfully compiles without missing modules or circular dependencies.
