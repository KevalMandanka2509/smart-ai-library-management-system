import os
import json
import urllib.request
import re
from datetime import datetime, timezone
from bson.objectid import ObjectId

class AIIntentEngine:
    def __init__(self, db_client, role: str, username: str):
        self.db = db_client
        self.role = role
        self.username = username
        self.intents = []
        self.entities = {}
        self.responses = []
        self.lang = "en"
        self.confidence = 1.0

    def get_gemini_key(self):
        from app.services.gemini_key_manager import GeminiKeyManager
        return GeminiKeyManager().get_available_key()

    def detect_language_fallback(self, message: str):
        self.lang = "en"

    def detect_intents_and_entities_fallback(self, message: str, history: list):
        msg_lower = message.lower().strip()
        msg_lower = re.sub(r'[^\w\s]', '', msg_lower)
        
        # Privacy & Injection checks
        if "ignore" in msg_lower or "prompt" in msg_lower or "instructions" in msg_lower or ("administrator" in msg_lower and self.role != "admin"):
            self.intents.append("SECURITY_VIOLATION")
            return
        if "another member" in msg_lower or "other user" in msg_lower or "all user" in msg_lower or ("admin information" in msg_lower and self.role != "admin") or "other member" in msg_lower or "all member" in msg_lower:
            self.intents.append("PRIVACY_VIOLATION")
            return
            
        # Contextual reference resolution (naive memory)
        if "this book" in msg_lower or "that book" in msg_lower or "it" in msg_lower or "its" in msg_lower or "ones" in msg_lower or "they" in msg_lower:
            if history and len(history) > 0:
                last_user = next((h.get("parts")[0].get("text").lower() for h in reversed(history) if h.get("role") == "user"), "")
                msg_lower += " " + last_user
                
        if "how many member" in msg_lower or ("registered" in msg_lower and "member" in msg_lower):
            self.intents.append("STUDENT_COUNT")
        elif "how many librarian" in msg_lower:
            self.intents.append("LIBRARIAN_COUNT")
        elif "how many book" in msg_lower and "available" in msg_lower:
            self.intents.append("AVAILABLE_COUNT")
        elif "how many book" in msg_lower and "borrow" in msg_lower:
            self.intents.append("BORROWED_COUNT")
        elif "how many book" in msg_lower and "overdue" in msg_lower:
            self.intents.append("OVERDUE_COUNT")
        elif "how many book" in msg_lower:
            self.intents.append("BOOK_COUNT")
        elif "outstanding fine" in msg_lower or "total fine" in msg_lower:
            self.intents.append("TOTAL_FINES")
        elif "which book" in msg_lower and "overdue" in msg_lower:
            self.intents.append("OVERDUE_BOOKS")
        elif "financial analytics" in msg_lower or "library analytics" in msg_lower:
            self.intents.append("LIBRARY_ANALYTICS")
        elif ("what book" in msg_lower or "which book" in msg_lower) and "i borrow" in msg_lower:
            self.intents.append("MY_BORROWS")
        elif "when are my book" in msg_lower and "due" in msg_lower:
            self.intents.append("MY_DUE_DATES")
        elif "do i have" in msg_lower and "overdue" in msg_lower:
            self.intents.append("MY_OVERDUE")
        elif "my current fine" in msg_lower or "my fine" in msg_lower:
            self.intents.append("MY_FINES")
        elif "reservation" in msg_lower:
            self.intents.append("MY_RESERVATIONS")
        elif "available" in msg_lower and "book" in msg_lower:
            self.intents.append("BOOK_AVAILABILITY")
        elif "borrowed" in msg_lower and "book" in msg_lower:
            self.intents.append("ACTIVE_BORROWS")
        elif "overdue" in msg_lower and "book" in msg_lower:
            self.intents.append("OVERDUE_BOOKS")
        else:
            self.intents.append("UNKNOWN")

    def detect_intents_and_entities(self, message: str, history: list = None):
        return self.detect_intents_and_entities_fallback(message, history)

    def _t(self, text_en, text_hi=None, text_gu=None):
        return text_en

    def authorize_and_execute(self):
        if not self.intents:
            self.responses.append(self._t("I couldn't find that in the library records."))
            return

        intent = self.intents[0]
        
        if intent == "SECURITY_VIOLATION":
            self.responses.append(self._t("I cannot fulfill that request due to security restrictions."))
            
        elif intent == "PRIVACY_VIOLATION":
            self.responses.append(self._t("You don't have permission to access other users' information."))
            
        elif intent == "STUDENT_COUNT":
            if self.role == "member":
                self.responses.append(self._t("You don't have permission to see this."))
                return
            ts = self.db.students.count_documents({})
            self.responses.append(self._t(f"We currently have **{ts} registered members**."))
            
        elif intent == "LIBRARIAN_COUNT":
            if self.role == "member":
                self.responses.append(self._t("You don't have permission to see this."))
                return
            tl = self.db.users.count_documents({"role": "librarian"})
            self.responses.append(self._t(f"We currently have **{tl} librarians**."))
            
        elif intent == "BOOK_COUNT":
            tb = self.db.books.count_documents({})
            self.responses.append(self._t(f"Your library currently has **{tb} distinct book titles**."))
            
        elif intent == "AVAILABLE_COUNT":
            ta = self.db.books.count_documents({"is_available": True})
            self.responses.append(self._t(f"There are currently **{ta} books available**."))
            
        elif intent == "BORROWED_COUNT":
            tb = self.db.borrows.count_documents({"status": "issued"})
            self.responses.append(self._t(f"There are currently **{tb} books borrowed**."))
            
        elif intent == "OVERDUE_COUNT":
            from datetime import datetime
            to = self.db.borrows.count_documents({"status": "issued", "due_date": {"$lt": datetime.now(timezone.utc).replace(tzinfo=None)}})
            self.responses.append(self._t(f"There are **{to} overdue books**."))
            
        elif intent == "TOTAL_FINES":
            if self.role == "member":
                self.responses.append(self._t("You don't have permission to see this."))
                return
            pipeline = [{"$match": {"paid": False}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
            res = list(self.db.fines.aggregate(pipeline))
            total = res[0]["total"] if res else 0
            self.responses.append(self._t(f"The total outstanding fine is **{total}**."))
            
        elif intent == "OVERDUE_BOOKS":
            if self.role == "member":
                self.responses.append(self._t("You don't have permission to see this."))
                return
            from datetime import datetime
            borrows = list(self.db.borrows.find({"status": "issued", "due_date": {"$lt": datetime.now(timezone.utc).replace(tzinfo=None)}}))
            if not borrows:
                self.responses.append(self._t("There are no overdue books."))
            else:
                lines = []
                for b in borrows:
                    try:
                        book = self.db.books.find_one({"_id": ObjectId(b.get("book_id"))})
                        t = book.get("title") if book else "Unknown"
                        lines.append(f"- **{t}** (Due: {b.get('due_date').strftime('%Y-%m-%d')})")
                    except: pass
                self.responses.append(self._t("Overdue books:\n" + "\n".join(lines)))
                
        elif intent == "LIBRARY_ANALYTICS":
            if self.role == "member":
                self.responses.append(self._t("You don't have permission to see this."))
                return
            tb = self.db.books.count_documents({})
            tu = self.db.students.count_documents({})
            ab = self.db.borrows.count_documents({"status": "issued"})
            self.responses.append(self._t(f"### Library Analytics\n\n- **Total Books:** {tb}\n- **Total Students:** {tu}\n- **Active Borrows:** {ab}"))
            
        elif intent == "MY_BORROWS":
            borrows = list(self.db.borrows.find({"student_id": self.username, "status": "issued"}))
            if not borrows:
                self.responses.append(self._t("You have no active borrowed books."))
            else:
                lines = []
                for b in borrows:
                    try:
                        book = self.db.books.find_one({"_id": ObjectId(b.get("book_id"))})
                        t = book.get("title") if book else "Unknown"
                        lines.append(f"- **{t}**")
                    except: pass
                self.responses.append(self._t("Your borrowed books:\n" + "\n".join(lines)))
                
        elif intent == "MY_DUE_DATES":
            borrows = list(self.db.borrows.find({"student_id": self.username, "status": "issued"}))
            if not borrows:
                self.responses.append(self._t("You have no active borrowed books."))
            else:
                lines = []
                for b in borrows:
                    try:
                        book = self.db.books.find_one({"_id": ObjectId(b.get("book_id"))})
                        t = book.get("title") if book else "Unknown"
                        due = b.get('due_date').strftime('%Y-%m-%d') if b.get('due_date') else 'Unknown'
                        lines.append(f"- **{t}**: Due on {due}")
                    except: pass
                self.responses.append(self._t("Your due dates:\n" + "\n".join(lines)))
                
        elif intent == "MY_OVERDUE":
            from datetime import datetime
            borrows = list(self.db.borrows.find({"student_id": self.username, "status": "issued", "due_date": {"$lt": datetime.now(timezone.utc).replace(tzinfo=None)}}))
            if borrows:
                self.responses.append(self._t("Yes, you have overdue books."))
            else:
                self.responses.append(self._t("No, you don't have any overdue books."))
                
        elif intent == "MY_FINES":
            fines = list(self.db.fines.find({"student_id": self.username, "paid": False}))
            if not fines:
                self.responses.append(self._t("You have **no unpaid fines**."))
            else:
                total = sum(f.get("amount", 0) for f in fines)
                self.responses.append(self._t(f"You have **{len(fines)} unpaid fine(s)** totaling **{total}**."))
                
        elif intent == "MY_RESERVATIONS":
            reservations = list(self.db.reservations.find({"student_id": self.username, "status": "pending"}))
            if not reservations:
                self.responses.append(self._t("You have no pending reservations."))
            else:
                lines = []
                for r in reservations:
                    try:
                        book = self.db.books.find_one({"_id": ObjectId(r.get("book_id"))})
                        t = book.get("title") if book else "Unknown"
                        lines.append(f"- **{t}**")
                    except: pass
                self.responses.append(self._t("Your reservations:\n" + "\n".join(lines)))
                
        elif intent == "BOOK_AVAILABILITY":
            books = list(self.db.books.find({"is_available": True}).limit(5))
            if books:
                lines = [f"- **{b.get('title')}**" for b in books]
                self.responses.append(self._t("Here are some available books:\n" + "\n".join(lines)))
            else:
                self.responses.append(self._t("No available books currently."))
                
        elif intent == "ACTIVE_BORROWS":
            if self.role == "member":
                self.responses.append(self._t("You don't have permission to see this."))
                return
            borrows = list(self.db.borrows.find({"status": "issued"}).limit(5))
            if not borrows:
                self.responses.append(self._t("There are no active borrowed books."))
            else:
                lines = []
                for b in borrows:
                    try:
                        book = self.db.books.find_one({"_id": ObjectId(b.get("book_id"))})
                        t = book.get("title") if book else "Unknown"
                        lines.append(f"- **{t}**")
                    except: pass
                self.responses.append(self._t("Currently active borrows:\n" + "\n".join(lines)))
                
        else:
            self.responses.append(self._t("I am a library assistant. I can help you find books, check your reservations, or show library statistics. How can I help you today?"))

    def generate_response(self):
        if not self.responses:
            return "I couldn't find that in the library records."
        return "\n\n".join(self.responses)

def process_chat_query(message: str, db_client, role: str, username: str, history: list = None) -> str:
    engine = AIIntentEngine(db_client, role, username)
    engine.detect_intents_and_entities(message, history)
    engine.authorize_and_execute()
    return engine.generate_response()