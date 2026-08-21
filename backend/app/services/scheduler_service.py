import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
import asyncio
from typing import Any

from ..database import Database
from .email_service import EmailService

logger = logging.getLogger("app.scheduler")

scheduler = AsyncIOScheduler()

async def generate_and_send_scheduled_reports():
    """
    Periodic job that queries the `scheduled_reports` collection and
    sends reports if they are due based on frequency.
    """
    # Use the globally initialized database connection
    # It assumes db.client is ready and we can access db.get_db() or db.client['library_db']
    from ..database import db as db_instance
    try:
        raw_db = db_instance.get_db()
    except Exception as e:
        logger.error(f"Scheduler could not access database: {e}")
        return

    now = datetime.utcnow()
    reports = list(raw_db.scheduled_reports.find({}))
    
    for report in reports:
        freq = report.get("frequency")
        email = report.get("email")
        last_sent = report.get("last_sent")
        report_id = report["_id"]

        should_send = False
        
        if not last_sent:
            should_send = True
        else:
            diff = now - last_sent
            if freq == "daily" and diff.days >= 1:
                should_send = True
            elif freq == "weekly" and diff.days >= 7:
                should_send = True
            elif freq == "monthly" and diff.days >= 30:
                should_send = True

        if should_send:
            logger.info(f"Attempting to lock {freq} report for {email}")
            
            # 1. Acquire distributed lock (expires after 5 minutes)
            lock_cutoff = now - timedelta(minutes=5)
            acquired = raw_db.scheduled_reports.find_one_and_update(
                {
                    "_id": report_id,
                    "$or": [
                        {"locked": {"$ne": True}},
                        {"locked_at": {"$lt": lock_cutoff}}
                    ]
                },
                {"$set": {"locked": True, "locked_at": now}},
                return_document=True
            )
            
            if not acquired:
                logger.info(f"Report {report_id} is already locked by another worker.")
                continue
                
            # 2. Double-check last_sent inside the lock to prevent race conditions
            last_sent_locked = acquired.get("last_sent")
            should_send_locked = False
            if not last_sent_locked:
                should_send_locked = True
            else:
                diff_locked = now - last_sent_locked
                if freq == "daily" and diff_locked.days >= 1:
                    should_send_locked = True
                elif freq == "weekly" and diff_locked.days >= 7:
                    should_send_locked = True
                elif freq == "monthly" and diff_locked.days >= 30:
                    should_send_locked = True
                    
            if not should_send_locked:
                # Another worker already completed it
                raw_db.scheduled_reports.update_one(
                    {"_id": report_id},
                    {"$set": {"locked": False, "locked_at": None}}
                )
                continue

            logger.info(f"Generating {freq} report for {email}")
            try:
                # Basic mock-up of report content for MVP, querying current stats
                total_books = raw_db.books.count_documents({})
                total_students = raw_db.students.count_documents({})
                active_borrows = raw_db.borrows.count_documents({"status": "issued"})
                overdue = raw_db.borrows.count_documents({"status": "issued", "due_date": {"$lt": now}})
                
                html_body = f"""
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #0f172a;">Smart AI Library - {freq.capitalize()} Report</h2>
                    <p>Here is the automated summary generated on {now.strftime("%Y-%m-%d %H:%M:%S")}.</p>
                    <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                        <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                            <th style="padding: 10px; text-align: left;">Metric</th>
                            <th style="padding: 10px; text-align: right;">Value</th>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Total Books</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">{total_books}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Total Students</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">{total_students}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Active Borrows</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">{active_borrows}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Overdue Books</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #ef4444; font-weight: bold;">{overdue}</td>
                        </tr>
                    </table>
                    <p style="color: #64748b; font-size: 12px; margin-top: 20px;">This is an automated message. Do not reply.</p>
                </div>
                """
                
                # Dispatch Email
                await EmailService.send_email_async(
                    recipient_email=email,
                    subject=f"Library {freq.capitalize()} Analytics Report",
                    html_body=html_body,
                    template_name="scheduled_report",
                    template_args={"freq": freq},
                    db=raw_db
                )
                
                # Update last_sent and release lock
                raw_db.scheduled_reports.update_one(
                    {"_id": report_id},
                    {"$set": {"last_sent": datetime.utcnow(), "locked": False, "locked_at": None}}
                )
                logger.info(f"✅ Successfully sent {freq} report to {email}")
            except Exception as e:
                logger.error(f"❌ Failed to generate or send report for {email}: {e}")
                # Release lock on failure so it can be retried
                raw_db.scheduled_reports.update_one(
                    {"_id": report_id},
                    {"$set": {"locked": False, "locked_at": None}}
                )

def start_scheduler():
    if not scheduler.running:
        # Check every 10 minutes to see if a report is due
        # For testing, you could change this to minutes=1
        scheduler.add_job(generate_and_send_scheduled_reports, IntervalTrigger(minutes=10), id="send_scheduled_reports", replace_existing=True)
        scheduler.start()
        logger.info("⏱️ APScheduler started.")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("🛑 APScheduler stopped.")
