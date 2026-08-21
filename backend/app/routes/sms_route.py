from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import time
from collections import defaultdict

from ..database import get_db
from ..core.security import get_current_admin
from ..services.sms_service import SmsService
import asyncio

# P0-4: In-memory rate limiter for OTP endpoints
_otp_rate_limit = defaultdict(list)  # {client_ip: [timestamps]}
_OTP_RATE_WINDOW = 600  # 10 minutes
_OTP_RATE_LIMIT = 5     # max 5 OTP requests per window per IP

def _check_otp_rate_limit(client_ip: str):
    """Check and enforce OTP rate limit. Raises HTTPException if exceeded."""
    now = time.time()
    cutoff = now - _OTP_RATE_WINDOW
    timestamps = _otp_rate_limit[client_ip]
    # Clean old entries
    while timestamps and timestamps[0] < cutoff:
        timestamps.pop(0)
    if len(timestamps) >= _OTP_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please try again later."
        )
    timestamps.append(now)

router = APIRouter(prefix="/api/v1/sms", tags=["SMS Service"])

class SmsSettingsRequest(BaseModel):
    provider: str = Field(..., description="Provider: twilio, vonage, msg91, custom, mock")
    api_key: Optional[str] = ""
    api_secret: Optional[str] = ""
    sender_id: str = "SMARTLIB"

class TestSmsRequest(BaseModel):
    phone: str

class CustomSmsRequest(BaseModel):
    recipient_phone: Optional[str] = None
    broadcast_all_members: bool = False
    message: str

class OtpRequest(BaseModel):
    phone: str

class OtpVerifyRequest(BaseModel):
    phone: str
    code: str

# ─────────────────────────────────────────────
# 1. GET PROVIDER SETTINGS
# ─────────────────────────────────────────────
@router.get("/settings", response_model=dict)
async def get_sms_settings(db=Depends(get_db), current_admin=Depends(get_current_admin)):
    """Retrieve active SMS provider settings."""
    cfg = SmsService.get_sms_config(db)
    if cfg.get("api_key"):
        cfg["api_key"] = "••••••••"
    if cfg.get("api_secret"):
        cfg["api_secret"] = "••••••••"
    return cfg

# ─────────────────────────────────────────────
# 2. UPDATE PROVIDER SETTINGS
# ─────────────────────────────────────────────
@router.post("/settings", response_model=dict)
async def update_sms_settings(
    payload: SmsSettingsRequest,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Save SMS provider settings in database."""
    data = payload.dict()
    old_cfg = SmsService.get_sms_config(db)
    
    if data.get("api_key") == "••••••••":
        data["api_key"] = old_cfg.get("api_key", "")
    if data.get("api_secret") == "••••••••":
        data["api_secret"] = old_cfg.get("api_secret", "")

    db.system_settings.update_one(
        {"key": "sms_config"},
        {"$set": {"key": "sms_config", "value": data, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    return {"message": "SMS provider configuration saved successfully"}

# ─────────────────────────────────────────────
# 3. DISPATCH TEST SMS
# ─────────────────────────────────────────────
@router.post("/test", response_model=dict)
async def send_test_sms(
    request: TestSmsRequest,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Send an SMS connection test message."""
    success = await SmsService.send_sms_async(
        request.phone,
        "Smart AI Library SMS Test: Your SMS configuration is verified and fully functional!",
        "sms_test",
        db
    )
    if not success:
        return {
            "status": "warning",
            "message": f"Test SMS dispatched via simulation fallback logger to {request.phone}. Check console output."
        }
    return {
        "status": "success",
        "message": f"Test SMS sent successfully to {request.phone}"
    }

# ─────────────────────────────────────────────
# 4. BULK TRIGGER DUE REMINDERS
# ─────────────────────────────────────────────
@router.post("/remind-due", response_model=dict)
async def trigger_due_reminders(
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Scan all active borrows and send due/overdue SMS reminders."""
    now = datetime.utcnow()
    active_borrows = list(db.borrows.find({"status": "issued"}))

    student_ids = list({b.get("student_id") for b in active_borrows if b.get("student_id")})
    students_cursor = db.students.find({"student_id": {"$in": student_ids}})
    students_map = {s["student_id"]: s for s in students_cursor}

    import asyncio
    semaphore = asyncio.Semaphore(10)

    async def process_borrow(borrow):
        student_id = borrow.get("student_id")
        student = students_map.get(student_id) if student_id else None
        phone = student.get("phone") if student else None

        if phone:
            due_dt = borrow.get("due_date")
            due_str = due_dt.strftime("%Y-%m-%d") if isinstance(due_dt, datetime) else str(due_dt or "N/A")
            days_overdue = 0
            if isinstance(due_dt, datetime) and due_dt < now:
                days_overdue = (now - due_dt).days or 1

            student_name = borrow.get("student_name") or (student.get("full_name") if student else "Student")
            book_title = borrow.get("book_title", "Borrowed Book")

            async with semaphore:
                try:
                    await SmsService.send_due_reminder(
                        phone=phone,
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
        "message": f"Dispatched {dispatched_count} SMS reminders to active borrowers."
    }

# ─────────────────────────────────────────────
# 5. GET SMS DISPATCH HISTORY LOGS
# ─────────────────────────────────────────────
@router.get("/history", response_model=list)
async def get_sms_history(
    limit: int = 100,
    search: Optional[str] = None,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Fetch logs from sms_logs collection."""
    query = {}
    if search:
        query["$or"] = [
            {"recipient_phone": {"$regex": search, "$options": "i"}},
            {"message": {"$regex": search, "$options": "i"}},
            {"template_name": {"$regex": search, "$options": "i"}}
        ]
    logs = list(db.sms_logs.find(query).sort("dispatched_at", -1).limit(limit))
    for log in logs:
        log["id"] = str(log["_id"])
        del log["_id"]
    return logs

# ─────────────────────────────────────────────
# 6. RESEND SMS FROM LOG HISTORY
# ─────────────────────────────────────────────
@router.post("/resend/{log_id}", response_model=dict)
async def resend_sms(
    log_id: str,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Re-send an SMS from an existing log ID."""
    from bson import ObjectId
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid log ID format")

    log_entry = db.sms_logs.find_one({"_id": ObjectId(log_id)})
    if not log_entry:
        raise HTTPException(status_code=404, detail="SMS log record not found")

    phone = log_entry.get("recipient_phone")
    template_name = log_entry.get("template_name", "resend")
    template_args = log_entry.get("template_args", {})

    success = False
    if template_name == "issue_confirmation":
        success = await SmsService.send_issue_confirmation(phone, **template_args, db=db)
    elif template_name == "return_confirmation":
        success = await SmsService.send_return_confirmation(phone, **template_args, db=db)
    elif template_name == "due_reminder":
        success = await SmsService.send_due_reminder(phone, **template_args, db=db)
    elif template_name == "fine_notice":
        success = await SmsService.send_fine_reminder(phone, **template_args, db=db)
    elif template_name == "reservation_update":
        success = await SmsService.send_reservation_notification(phone, **template_args, db=db)
    elif template_name == "welcome_sms":
        success = await SmsService.send_welcome_sms(phone, **template_args, db=db)
    elif template_name == "custom_admin":
        success = await SmsService.send_custom_sms(phone, **template_args, db=db)
    else:
        raise HTTPException(status_code=400, detail="Unsupported template for resend")

    return {
        "success": success,
        "message": f"Resent SMS to {phone} ({'Success' if success else 'Failed'})"
    }

# ─────────────────────────────────────────────
# 7. SEND CUSTOM ADMIN SMS
# ─────────────────────────────────────────────
@router.post("/custom-send", response_model=dict)
async def send_custom_sms(
    payload: CustomSmsRequest,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin)
):
    """Dispatch custom SMS to individual or broadcast."""
    if payload.broadcast_all_members:
        # Collect members and students
        members = list(db.users.find({"role": "member"}, {"phone": 1}))
        students = list(db.students.find({}, {"phone": 1}))
        phones = set([m["phone"] for m in members if m.get("phone")] + [s["phone"] for s in students if s.get("phone")])
        import asyncio
        semaphore = asyncio.Semaphore(10)
        async def send_to_phone(ph):
            async with semaphore:
                try:
                    await SmsService.send_custom_sms(ph, payload.message, db=db)
                    return 1
                except Exception:
                    return 0
        tasks = [send_to_phone(ph) for ph in phones]
        results = await asyncio.gather(*tasks)
        count = sum(results)
        return {"success": True, "message": f"Broadcast SMS dispatched to {count} library members!"}

    if not payload.recipient_phone:
        raise HTTPException(status_code=400, detail="Recipient phone number required when not broadcasting")

    success = await SmsService.send_custom_sms(payload.recipient_phone, payload.message, db=db)
    return {"success": success, "message": f"Custom SMS sent to {payload.recipient_phone}"}

# ─────────────────────────────────────────────
# 8. GET LIST OF TEMPLATES
# ─────────────────────────────────────────────
@router.get("/templates", response_model=list)
async def get_sms_templates(current_admin=Depends(get_current_admin)):
    """Return available system plain-text SMS templates."""
    return [
        {"id": "otp_verification", "name": "OTP Verification Code", "description": "Verification code for verification processes."},
        {"id": "issue_confirmation", "name": "Book Issue Confirmation", "description": "Alert dispatched when borrowing a catalog item."},
        {"id": "return_confirmation", "name": "Book Return Confirmation", "description": "Alert dispatched when returning a borrowed item."},
        {"id": "due_reminder", "name": "Due & Overdue Reminder", "description": "Dispatched near or past return due date."},
        {"id": "fine_notice", "name": "Outstanding Fine Notice", "description": "Alert for charges applied to borrower accounts."},
        {"id": "reservation_update", "name": "Reservation Status Update", "description": "Status updates for catalog item hold holds."},
        {"id": "welcome_sms", "name": "Welcome Account SMS", "description": "Dispatched to new accounts upon registration."},
        {"id": "custom_admin", "name": "Custom Admin SMS Announcement", "description": "Broadcast notice dispatched manually by librarian."}
    ]

# ─────────────────────────────────────────────
# 9. GENERATE & SEND OTP
# ─────────────────────────────────────────────
@router.post("/send-otp", response_model=dict)
async def generate_otp(payload: OtpRequest, request: Request, db=Depends(get_db)):
    """Generate and dispatch SMS OTP code."""
    # P0-4: Rate limiting
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_otp_rate_limit(client_ip)
    
    # P0-4: Validate phone belongs to an existing user or student
    phone = payload.phone.strip()
    user_exists = db.users.find_one({"phone": phone}) or db.students.find_one({"phone": phone})
    if not user_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is not associated with any account"
        )
    
    otp_code = await SmsService.send_otp_sms(phone, db=db)
    if not otp_code:
        raise HTTPException(status_code=500, detail="Failed to dispatch OTP verification SMS")
    return {"success": True, "message": "OTP verification SMS sent successfully"}

# ─────────────────────────────────────────────
# 10. VERIFY OTP CODE
# ─────────────────────────────────────────────
@router.post("/verify-otp", response_model=dict)
async def verify_otp(payload: OtpVerifyRequest, request: Request, db=Depends(get_db)):
    """Verify code matches for phone."""
    # P0-4: Rate limiting on verify too
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_otp_rate_limit(client_ip)
    
    is_valid = SmsService.verify_otp(payload.phone, payload.code, db=db)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP verification code")
    return {"success": True, "message": "OTP verification code validated successfully"}
