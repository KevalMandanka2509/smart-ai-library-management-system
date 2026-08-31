from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone

from ..database import get_db
from ..core.security import get_current_admin
from ..services.email_service import EmailService
import asyncio

router = APIRouter(prefix="/api/v1/email", tags=["Email Service"])

class SmtpSettingsRequest(BaseModel):
    host: str
    port: int = 587
    username: Optional[str] = ""
    password: Optional[str] = ""
    from_email: str
    from_name: str = "Smart AI Library"
    tls: bool = True

class TestEmailRequest(BaseModel):
    recipient_email: EmailStr

# ─────────────────────────────────────────────
# 1. GET SMTP SETTINGS
# ─────────────────────────────────────────────
@router.get("/settings", response_model=dict)
async def get_smtp_settings(db=Depends(get_db), current_admin=Depends(get_current_admin)):
    """Retrieve active SMTP settings."""
    cfg = EmailService.get_smtp_config(db)
    # Mask password for security
    if cfg.get("password"):
        cfg["password"] = "••••••••"
    return cfg

# ─────────────────────────────────────────────
# 2. UPDATE SMTP SETTINGS
# ─────────────────────────────────────────────
@router.post("/settings", response_model=dict)
async def update_smtp_settings(
    settings_payload: SmtpSettingsRequest,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Save updated SMTP settings in Database."""
    data = settings_payload.dict()
    # Preserve old password if masked placeholder passed
    if data.get("password") == "••••••••":
        old_cfg = EmailService.get_smtp_config(db)
        data["password"] = old_cfg.get("password", "")

    db.system_settings.update_one(
        {"key": "smtp_config"},
        {"$set": {"key": "smtp_config", "value": data, "updated_at": datetime.now(timezone.utc).replace(tzinfo=None)}},
        upsert=True
    )
    return {"message": "SMTP settings saved successfully"}

# ─────────────────────────────────────────────
# 3. DISPATCH TEST EMAIL
# ─────────────────────────────────────────────
@router.post("/test", response_model=dict)
async def send_test_email(
    request: TestEmailRequest,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Send an SMTP connection test email."""
    success = await EmailService.send_test_email(request.recipient_email, db)
    if not success:
        return {
            "status": "warning",
            "message": f"Test email dispatched via fallback logger to {request.recipient_email}. (Verify SMTP server credentials if real email delivery is expected)."
        }
    return {
        "status": "success",
        "message": f"Test email sent successfully to {request.recipient_email}"
    }

# ─────────────────────────────────────────────
# 4. BULK TRIGGER DUE REMINDERS
# ─────────────────────────────────────────────
@router.post("/remind-due", response_model=dict)
async def trigger_due_reminders(
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Scan all active borrows and send due/overdue email reminders."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    active_borrows = list(db.borrows.find({"status": "issued"}))

    student_ids = list({b.get("student_id") for b in active_borrows if b.get("student_id")})
    students_cursor = db.students.find({"student_id": {"$in": student_ids}})
    students_map = {s["student_id"]: s for s in students_cursor}

    import asyncio
    semaphore = asyncio.Semaphore(10)
    
    async def process_borrow(borrow):
        student_id = borrow.get("student_id")
        student = students_map.get(student_id) if student_id else None
        student_email = student.get("email") if student else None

        if student_email:
            due_dt = borrow.get("due_date")
            due_str = due_dt.strftime("%Y-%m-%d") if isinstance(due_dt, datetime) else str(due_dt or "N/A")
            days_overdue = 0
            if isinstance(due_dt, datetime) and due_dt < now:
                days_overdue = (now - due_dt).days or 1

            student_name = borrow.get("student_name") or (student.get("full_name") if student else "Student")
            book_title = borrow.get("book_title", "Borrowed Book")

            async with semaphore:
                try:
                    await EmailService.send_due_reminder(
                        recipient_email=student_email,
                        student_name=student_name,
                        book_title=book_title,
                        due_date=due_str,
                        days_overdue=days_overdue,
                        db=db
                    )
                    return 1
                except Exception:
                    pass
        return 0

    tasks = [process_borrow(b) for b in active_borrows]
    results = await asyncio.gather(*tasks)
    dispatched_count = sum(results)

    return {
        "message": f"Dispatched {dispatched_count} due/overdue reminders to active borrowers."
    }

class CustomEmailRequest(BaseModel):
    recipient_email: Optional[str] = None
    broadcast_all_members: bool = False
    subject: str
    message: str

class ScheduleSettingsRequest(BaseModel):
    enabled: bool = True
    daily_reminder_time: str = "08:00"

# ─────────────────────────────────────────────
# 5. GET EMAIL DISPATCH HISTORY LOGS
# ─────────────────────────────────────────────
@router.get("/history", response_model=list)
async def get_email_history(
    limit: int = 100,
    search: Optional[str] = None,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Fetch logs from email_logs collection."""
    query = {}
    if search:
        query["$or"] = [
            {"recipient_email": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}},
            {"template_name": {"$regex": search, "$options": "i"}}
        ]
    logs = list(db.email_logs.find(query).sort("dispatched_at", -1).limit(limit))
    for log in logs:
        log["id"] = str(log["_id"])
        del log["_id"]
    return logs

# ─────────────────────────────────────────────
# 6. RESEND EMAIL FROM LOG HISTORY
# ─────────────────────────────────────────────
@router.post("/resend/{log_id}", response_model=dict)
async def resend_email(
    log_id: str,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Re-send an email from an existing log ID."""
    from bson import ObjectId
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid log ID format")

    log_entry = db.email_logs.find_one({"_id": ObjectId(log_id)})
    if not log_entry:
        raise HTTPException(status_code=404, detail="Email log record not found")

    recipient = log_entry.get("recipient_email")
    template_name = log_entry.get("template_name", "resend")
    template_args = log_entry.get("template_args", {})

    success = False
    if template_name == "issue_confirmation":
        success = await EmailService.send_issue_confirmation(recipient, **template_args, db=db)
    elif template_name == "return_confirmation":
        success = await EmailService.send_return_confirmation(recipient, **template_args, db=db)
    elif template_name == "due_reminder":
        success = await EmailService.send_due_reminder(recipient, **template_args, db=db)
    elif template_name == "fine_notice":
        success = await EmailService.send_fine_reminder(recipient, **template_args, db=db)
    elif template_name == "reservation_update":
        success = await EmailService.send_reservation_notification(recipient, **template_args, db=db)
    elif template_name == "welcome_email":
        success = await EmailService.send_welcome_email(recipient, **template_args, db=db)
    elif template_name == "custom_admin":
        success = await EmailService.send_custom_email(recipient, **template_args, db=db)
    elif template_name == "smtp_test":
        success = await EmailService.send_test_email(recipient, db=db)
    else:
        raise HTTPException(status_code=400, detail="Unsupported template for resend")

    return {
        "success": success,
        "message": f"Resent email to {recipient} ({'Success' if success else 'Failed'})"
    }

# ─────────────────────────────────────────────
# 7. SEND CUSTOM ADMIN ANNOUNCEMENT EMAIL
# ─────────────────────────────────────────────
@router.post("/custom-send", response_model=dict)
async def send_custom_announcement(
    payload: CustomEmailRequest,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Dispatch custom admin broadcast or direct email."""
    if payload.broadcast_all_members:
        members = list(db.users.find({"role": "member"}, {"email": 1, "full_name": 1}))
        students = list(db.students.find({}, {"email": 1, "full_name": 1}))
        emails = set([m["email"] for m in members if m.get("email")] + [s["email"] for s in students if s.get("email")])
        import asyncio
        semaphore = asyncio.Semaphore(10)
        async def send_to_email(em):
            async with semaphore:
                try:
                    await EmailService.send_custom_email(em, payload.subject, payload.message, db=db)
                    return 1
                except Exception:
                    return 0
        tasks = [send_to_email(em) for em in emails]
        results = await asyncio.gather(*tasks)
        count = sum(results)
        return {"success": True, "message": f"Broadcast email dispatched to {count} library members!"}
    
    if not payload.recipient_email:
        raise HTTPException(status_code=400, detail="Recipient email required when not broadcasting")

    success = await EmailService.send_custom_email(payload.recipient_email, payload.subject, payload.message, db=db)
    return {"success": success, "message": f"Custom email sent to {payload.recipient_email}"}

# ─────────────────────────────────────────────
# 8. GET LIST OF TEMPLATES
# ─────────────────────────────────────────────
@router.get("/templates", response_model=list)
async def get_email_templates(current_admin=Depends(get_current_admin)):
    """Return available system HTML email templates."""
    return [
        {"id": "issue_confirmation", "name": "Book Issue Confirmation", "description": "Sent when a student borrows a book."},
        {"id": "return_confirmation", "name": "Book Return Confirmation", "description": "Sent when a borrowed book is returned."},
        {"id": "due_reminder", "name": "Due & Overdue Reminder", "description": "Sent prior to or after return deadline."},
        {"id": "fine_notice", "name": "Outstanding Fine Notice", "description": "Sent when a fine is assessed on an account."},
        {"id": "reservation_update", "name": "Reservation Status Update", "description": "Sent when book reservation changes state."},
        {"id": "welcome_email", "name": "Welcome Account Email", "description": "Sent to new registered users/students."},
        {"id": "password_reset", "name": "Password Reset OTP", "description": "Sent when password reset is requested."},
        {"id": "custom_admin", "name": "Custom Admin Announcement", "description": "Custom message created by librarian."}
    ]
