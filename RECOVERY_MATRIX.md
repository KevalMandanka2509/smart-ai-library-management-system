# RECOVERY MATRIX

| Module | Files | Status (A/B/C/D) | Recovery Required | Priority | Notes |
|---|---|---|---|---|---|
| **Contact Message Management System** | `backend/app/models/ContactMessage.py`, `backend/app/api/contact.py`, frontend admin pages | C | Yes | High | Model and endpoints missing completely from `backend/app/models/` and backend. |
| **Librarian Role Foundation** | `backend/app/core/security.py`, `backend/app/models/user_model.py` | C | Yes | High | Backend RBAC registry and permissions need to be updated with `librarian` role. |
| **Enterprise Command Palette Integration** | `frontend/src/index.css`, various component CSS | B | Yes | Medium | Centralized CSS variables need to be fully applied across all modules. |
| **Enterprise Report Scheduler UI** | `frontend/src/pages/Reports.jsx`, `Reports.css` | C | Yes | Medium | UI for scheduling reports (Daily/Weekly/Monthly) needs to be recreated in Reports module. |
| **Profile Module Refactor** | `frontend/src/pages/Profile.jsx`, `Profile.css` | B | Yes | High | Needs enterprise design system standardization (header, sections, transitions). |
| **Clean Dashboard CSS Tweaks** | `frontend/src/pages/Dashboard.css` | B | Yes | Low | Needs padding, margin, and gap tweaks for cleaner appearance without JSX changes. |
| **Card Component Spacing Optimization** | `books.css`, `Authors.css`, `Students.css`, `Dashboard.css` | B | Yes | Low | Vertical whitespace reduction needed across all card CSS files. |
| **Standardizing Library Management UI** | `Books.jsx`, `Authors.jsx` | B | Yes | Medium | Need to sync Books and Authors card layouts to exactly match Student Management layout. |
| **Author and Category Auth Fix** | Backend auth/JWT logic or Frontend interceptors | B | Yes | High | Fix 401 auth issues for Author and Category modules. |
| **Barcode & QR Code Management** | `BarcodeManagement.jsx`, `BarcodeManagement.css` | A | No | Low | Component exists and appears mostly complete, will skip unless issues found. |

> [!IMPORTANT]
> The source of truth for the missing implementations is the `recoverychats` directory. Please review this matrix. Once approved, I will begin the automated incremental recovery process module by module.
