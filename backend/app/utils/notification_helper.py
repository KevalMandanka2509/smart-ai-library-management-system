from datetime import datetime, timezone
import logging

logger = logging.getLogger("app.notifications")

async def create_notification(db, student_id: str, title: str, message: str, n_type: str, **kwargs):
    """
    Helper to create an in-app notification and trigger an email/sms dispatch simulation,
    respecting user notification preferences.
    """
    # Type mapping for preferences
    type_map = {
        "reservation_update": "reservations",
        "fine_reminder": "fine_alerts",
        "issue_reminder": "issue_alerts",
        "return_receipt": "issue_alerts",
        "system_alert": "due_reminders" # Fallback
    }
    pref_key = type_map.get(n_type, "issue_alerts")

    # Fetch preferences
    prefs = db.notification_settings.find_one({"username": student_id})
    if not prefs:
        prefs = {
            "browser_enabled": True,
            "email_enabled": True,
            "sms_enabled": False,
            "types": {
                "due_reminders": True,
                "issue_alerts": True,
                "fine_alerts": True,
                "reservations": True
            }
        }
        
    type_enabled = prefs.get("types", {}).get(pref_key, True)
    if not type_enabled and student_id != "admin":
        logger.info(f"🔕 Notification suppressed by user preference: [{n_type}] for {student_id}")
        return

    # 1. In-app notification
    if prefs.get("browser_enabled", True) or student_id == "admin":
        notif = {
            "student_id": student_id,
            "title": title,
            "message": message,
            "type": n_type,
            "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
            "read": False
        }
        db.notifications.insert_one(notif)
        logger.info(f"🔔 In-app notification created: [{n_type}] to student {student_id} - '{title}'")
    
    # 2. Email / SMS Dispatch Simulation
    email = None
    phone = None
    
    if student_id == "admin":
        email = "admin@library.com"
    else:
        student = db.students.find_one({"student_id": student_id})
        if student:
            email = student.get("email")
            phone = student.get("phone")
            
    if email and prefs.get("email_enabled", True):
        from ..services.email_service import EmailService, build_custom_email_html
        
        student_name = kwargs.get("student_name", student_id)
        
        if n_type == "issue_success":
            await EmailService.send_issue_confirmation(email, student_name, kwargs.get("book_title", ""), kwargs.get("issue_date", ""), kwargs.get("due_date", ""), db=db)
        elif n_type == "return_success":
            await EmailService.send_return_confirmation(email, student_name, kwargs.get("book_title", ""), kwargs.get("return_date", ""), db=db)
        elif n_type == "fine_reminder":
            await EmailService.send_fine_reminder(email, student_name, kwargs.get("book_title", ""), kwargs.get("amount", 0.0), kwargs.get("reason", ""), db=db)
        elif n_type == "due_reminders":
            await EmailService.send_due_reminder(email, student_name, kwargs.get("book_title", ""), kwargs.get("due_date", ""), kwargs.get("days_overdue", 0), db=db)
        elif n_type == "reservations":
            await EmailService.send_reservation_notification(email, student_name, kwargs.get("book_title", ""), kwargs.get("status_str", ""), db=db)
        else:
            html = build_custom_email_html(title, message)
            await EmailService.send_email_async(
                recipient_email=email,
                subject=title,
                html_body=html,
                template_name=n_type,
                template_args={"message": message},
                db=db
            )
        
    if phone and prefs.get("sms_enabled", False):
        from ..services.sms_service import SmsService, build_custom_sms
        student_name = kwargs.get("student_name", student_id)
        
        if n_type == "issue_success":
            await SmsService.send_issue_confirmation(phone, student_name, kwargs.get("book_title", ""), kwargs.get("due_date", ""), db=db)
        elif n_type == "return_success":
            await SmsService.send_return_confirmation(phone, student_name, kwargs.get("book_title", ""), db=db)
        elif n_type == "fine_reminder":
            await SmsService.send_fine_reminder(phone, student_name, kwargs.get("amount", 0.0), kwargs.get("book_title", ""), db=db)
        elif n_type == "due_reminders":
            await SmsService.send_due_reminder(phone, student_name, kwargs.get("book_title", ""), kwargs.get("due_date", ""), kwargs.get("days_overdue", 0), db=db)
        elif n_type == "reservations":
            await SmsService.send_reservation_notification(phone, student_name, kwargs.get("book_title", ""), kwargs.get("status_str", ""), db=db)
        else:
            sms_msg = build_custom_sms(title)
            await SmsService.send_sms_async(
                phone=phone,
                message=sms_msg,
                template_name=n_type,
                template_args={"title": title},
                db=db
            )
