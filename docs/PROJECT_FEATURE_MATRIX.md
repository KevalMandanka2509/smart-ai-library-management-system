# Project Feature & RBAC Matrix

The Smart AI Library Management System employs strict Role-Based Access Control (RBAC). 
Capabilities are governed by the user's role: `admin`, `librarian`, or `member`.

| Feature Module | Admin | Librarian | Member | Implementation Status |
|---|---|---|---|---|
| **Authentication** | Login, OTP Reset | Login, OTP Reset | Login, OTP Reset | ✔️ Completed |
| **System Settings** | Full Access | No Access | No Access | ✔️ Completed |
| **Manage Users (Staff)** | Full Access | No Access | No Access | ✔️ Completed |
| **Manage Students** | Full Access | Full Access | View Self Only | ✔️ Completed |
| **Catalogue (Books)** | CRUD | CRUD | View Only | ✔️ Completed |
| **Categories/Authors** | CRUD | CRUD | View Only | ✔️ Completed |
| **Issue Book** | Yes | Yes | No | ✔️ Completed |
| **Return Book** | Yes | Yes | No | ✔️ Completed |
| **Renew Book** | Yes | Yes | Request/Self | ✔️ Completed |
| **Reservations** | Manage All | Manage All | Create Self | ✔️ Completed |
| **Fines** | Manage All | Manage All | View/Pay Self | ✔️ Completed |
| **Dashboard/Reports** | Full Access | Operational Reports | Member Dashboard | ✔️ Completed |
| **Notifications** | View All | View All | View Self | ✔️ Completed |
| **Backup & Restore** | Full Access | No Access | No Access | ✔️ Completed |
| **Audit Logs** | Full Access | No Access | No Access | ✔️ Completed |
| **AI Chatbot** | Global Data | Global Data | Personal Data | ✔️ Completed |
