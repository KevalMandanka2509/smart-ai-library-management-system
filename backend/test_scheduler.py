import os
from pymongo import MongoClient
from datetime import datetime, timedelta, timezone
import asyncio
import time

os.environ["SMTP_HOST"] = "localhost" # To trigger simulated emails

client = MongoClient("mongodb://localhost:27017/")
db = client["library_db"]

async def async_main():
    # Insert a dummy scheduled report that was created a while ago
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # pretend we sent it 2 days ago for a daily report
    db.scheduled_reports.delete_many({"email": "admin@example.com"})
    db.email_logs.delete_many({"template_name": "scheduled_report"})

    report_id = db.scheduled_reports.insert_one({
        "frequency": "daily",
        "email": "admin@example.com",
        "created_at": now - timedelta(days=5),
        "last_sent": now - timedelta(days=2)
    }).inserted_id
    
    print("Inserted scheduled report. Running scheduler job concurrently...")
    
    from app.services.scheduler_service import generate_and_send_scheduled_reports
    
    # Launch 5 concurrent executions to simulate multi-worker environment
    tasks = [generate_and_send_scheduled_reports() for _ in range(5)]
    await asyncio.gather(*tasks)
    
    # Check email logs
    logs = list(db.email_logs.find({"template_name": "scheduled_report"}))
    assert len(logs) == 1, f"Expected exactly 1 email log despite 5 concurrent scheduler executions, got {len(logs)}"
    print("OK Scheduled report email dispatched exactly ONCE.")
    
    # Check that last_sent was updated
    report = db.scheduled_reports.find_one({"_id": report_id})
    assert report["last_sent"] > now - timedelta(minutes=1)
    assert report.get("locked") is False, "Lock should be released"
    print("OK Scheduled report last_sent updated and lock released.")
    
    print("All scheduler tests passed!")

if __name__ == "__main__":
    asyncio.run(async_main())
