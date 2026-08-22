# Future Scope

This document outlines the current state of the Smart AI Library Management System and potential avenues for future enhancements.

## COMPLETED
- **Core Library Operations**: Books, Categories, Authors, Students, and Admin Users CRUD.
- **Workflow Integrity**: Secure Borrow, Return, Renew, and Reservation lifecycles with strict concurrency control.
- **Automated Fines**: Real-time generation of fines based on dynamic admin settings, including automatic account locking limits.
- **Advanced Role-Based Access Control**: Strict segregation between Admin, Librarian, and Member privileges at both UI and API levels.
- **Grounded Multilingual AI Chatbot**: A production-ready Gemini integration supporting English, Gujarati, and Hinglish, heavily sandboxed to authorized library context.
- **Enterprise Utilities**: Multi-worker APScheduler integration, native MongoDB backup/restore API, and comprehensive security logging.
- **Frontend Polish**: Fully responsive React + Tailwind application with robust error handling and loading boundaries.
- **Testing**: Passing integration tests for concurrency, AI security, backups, magic bytes, and full system smoke tests.

## FUTURE / OPTIONAL
- **Physical Barcode/QR Scanning**: Hardware integration to natively scan physical book barcodes into the `BarcodeManagement` frontend module via a mobile device or USB scanner.
- **Real SMS/Email Gateway Integration**: Currently, the notification system runs on a robust queue and logging simulation. Future scope includes wiring this up to SendGrid (Email) and Twilio (SMS).
- **Payment Gateway**: Integration with Stripe or Razorpay for members to digitally pay fines through the frontend rather than paying physical cash at the librarian desk.
- **Single Sign-On (SSO)**: Add OAuth2 (Google/Microsoft) for student/member login.
- **WebHooks**: Enable integrations with third-party software for real-time event broadcasting (e.g., book borrowed).

## DEPLOYMENT
PENDING — DO NOT DEPLOY.

*Note: Deployment infrastructure (Dockerization, Vercel/Render hosting, MongoDB Atlas setup, CI/CD GitHub Actions) is strictly out of scope for the current development phase.*
