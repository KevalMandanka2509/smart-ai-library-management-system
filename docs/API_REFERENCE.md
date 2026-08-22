# API Reference

The backend exposes a highly structured RESTful interface powered by FastAPI.

## Authentication (`/api/v1/auth`)
- **POST `/api/v1/auth/login`**: Authenticates users and members. Returns a Bearer JWT. (Rate limited).
- **POST `/api/v1/auth/register`**: Registers a new Student/Member.
- **POST `/api/v1/auth/forgot-password`**: Triggers OTP.
- **POST `/api/v1/auth/verify-otp`**: Verifies provided OTP for account recovery.
- **POST `/api/v1/auth/reset-password`**: Finalizes recovery payload.

## Users (`/api/v1/users`)
- **GET `/api/v1/users/`**: List all system users (Admin only).
- **POST `/api/v1/users/`**: Create user (Admin only).
- **PUT `/api/v1/users/{id}`**: Update user details.
- **DELETE `/api/v1/users/{id}`**: Soft-delete/deactivate.

## Students (`/api/v1/students`)
- **GET `/api/v1/students/`**: List all students (Admin/Librarian).
- **POST `/api/v1/students/`**: Add new student profile.
- **GET `/api/v1/students/me`**: Get currently authenticated student.

## Books (`/api/v1/books`)
- **GET `/api/v1/books/`**: List all books (Open). Supports `q`, `category`, `sort`.
- **POST `/api/v1/books/`**: Add book (Admin/Librarian).
- **PUT `/api/v1/books/{id}`**: Update inventory (Admin/Librarian).
- **DELETE `/api/v1/books/{id}`**: Remove book (Admin/Librarian).

## Authors & Categories (`/api/v1/authors`, `/api/v1/categories`)
- **GET `/`**: List all.
- **POST `/`**: Add new (Admin/Librarian).

## Borrows (`/api/v1/borrows`)
- **POST `/api/v1/borrows/issue`**: Issue book to student (Admin/Librarian). Requires `book_id`, `student_id`.
- **POST `/api/v1/borrows/return/{id}`**: Mark borrow as returned. Automatically clears dependent fines if paid or assesses new ones.
- **POST `/api/v1/borrows/renew/{id}`**: Extends due date.

## Reservations (`/api/v1/reservations`)
- **POST `/api/v1/reservations/`**: Member queues a book that is out of stock.
- **GET `/api/v1/reservations/`**: List reservations.

## Fines (`/api/v1/fines`)
- **GET `/api/v1/fines/`**: View unpaid/paid fines. Members can only view their own.
- **POST `/api/v1/fines/pay/{id}`**: Process fine payment. Clears account block if all fines are resolved.

## Notifications (`/api/v1/notifications`)
- **GET `/api/v1/notifications/`**: List user's notifications.
- **PUT `/api/v1/notifications/{id}/read`**: Mark as read.

## Reports (`/api/v1/reports`)
- **GET `/api/v1/reports/dashboard`**: Fetch aggregate KPI statistics (Admin/Librarian).
- **GET `/api/v1/reports/overdue`**: List overdue active borrows.

## Settings (`/api/v1/settings`)
- **GET `/api/v1/settings/`**: Retrieve library configuration (max limit, fine rates).
- **PUT `/api/v1/settings/`**: Update policies (Admin only).

## Backup/Restore (`/api/v1/backup`)
- **POST `/api/v1/backup/create`**: Generate complete MongoDB export.
- **POST `/api/v1/backup/restore`**: Restore system from file using strict transaction blocks.

## AI Chatbot (`/api/v1/ai`)
- **POST `/api/v1/ai/chat`**: Process natural language. 
  - **Payload**: `{ "query": "string", "session_id": "string", "language": "string" }`
  - **Output**: JSON containing `message` and contextual DB data points.

## Audit (`/api/v1/audit`)
- **GET `/api/v1/audit/logs`**: Review chronological system actions (Admin only).
