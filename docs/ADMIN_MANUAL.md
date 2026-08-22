# Admin & Librarian Manual

This manual covers the operational and managerial features of the system. 
*Note: Librarians have access to day-to-day operations, while Admins have full system control including settings and backups.*

## 1. Dashboard
- **Admin/Librarian**: The dashboard provides a high-level view of library statistics (Total Books, Active Borrows, Overdue items, Total Revenue from fines).

## 2. User & Student Management
- **Students (Admin & Librarian)**: Navigate to **Students** to add new members, edit their details, or view their borrowing history.
- **Users (Admin Only)**: Navigate to **Users** to manage staff (create other Admins or Librarians). You can lock/unlock accounts here.

## 3. Book Management
- Navigate to **Books**.
- Click **Add Book** to create a new catalogue entry. You will need to specify the Title, Author, Category, and Total Copies.
- You can edit existing books or delete them. *Note: You cannot delete a book if it is currently issued to a student.*

## 4. Authors & Categories
- Manage metadata by going to the **Authors** or **Categories** pages. Adding these ensures the books are correctly grouped for search and analytics.

## 5. Borrow & Return Operations
- Navigate to **Issue/Return** (or manage it directly from the student's profile).
- **Issue**: Select a Student and a Book. The system will enforce limits (e.g., maximum books a student can hold, and concurrent issue protection).
- **Return**: Locate the active borrow record and mark it returned. If it is past the due date, the system will automatically generate a **Fine**.

## 6. Fines
- Navigate to **Fines** to see all unpaid penalties across the library.
- When a student pays at the desk, mark the fine as **Paid** here to clear their account blocks.

## 7. Reports
- Go to **Reports** to generate specific data exports (e.g., Overdue Books, Financial summaries).

## 8. Settings (Admin Only)
- Go to **Settings**.
- Here you can configure system-wide rules:
  - **Max Books per Student**
  - **Max Borrow Days**
  - **Daily Fine Rate (₹)**
  - **Max Fines before Account Block**

## 9. Backup & Restore (Admin Only)
- Go to **Settings > Backup/Restore**.
- **Backup**: Downloads a complete secure JSON snapshot of the MongoDB database.
- **Restore**: Upload a backup file to rollback the system. *Warning: This overwrites current data. Use with caution.*

## 10. Audit & Security (Admin Only)
- Go to **Audit Logs** to view chronological security events (e.g., who deleted a book, who changed settings, failed logins).

## 11. AI Chatbot
- Staff can also use the AI Chatbot to query complex statistics quickly, e.g., "Show me all overdue books" or "What is our total fine revenue this month?".
