"""
Database connection and initialization module.

NOTE (P2-25): This application uses synchronous `pymongo` with FastAPI `async def` routes.
While this works for low-to-medium traffic, it can block the asyncio event loop under high load.
For high-concurrency production deployments, consider migrating to `motor` (async pymongo) 
or changing route definitions from `async def` to `def` so FastAPI runs them in a threadpool.
"""
from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from .config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    """Singleton MongoDB connection manager"""
    _instance = None
    _client = None
    _db = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def connect(self):
        """Establish connection to MongoDB"""
        try:
            if self._client is None:
                self._client = MongoClient(
                    settings.MONGODB_URL,
                    maxPoolSize=50,
                    minPoolSize=10,
                    maxIdleTimeMS=30000,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=5000,
                    socketTimeoutMS=20000,
                    retryWrites=True,
                    retryReads=True,
                    compressors="zstd,snappy,zlib",
                )
                # Ping to verify connection
                self._client.admin.command('ping')
                self._db = self._client[settings.DATABASE_NAME]
                logger.info(f"✅ Connected to MongoDB: {settings.DATABASE_NAME}")
                
                # Create indexes
                self._create_indexes()
                
            return self._db
        except Exception as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            raise e
    
    def close(self):
        """Close MongoDB connection"""
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            logger.info("🔒 MongoDB connection closed")
    
    def get_db(self):
        """Get database instance"""
        if self._db is None:
            self.connect()
        return self._db
    
    def _ensure_index(self, collection, keys, **kwargs):
        """
        Idempotent index creation. Never drops existing indexes.
        If an index with conflicting options exists, it logs a warning instead of dropping it.
        """
        try:
            collection.create_index(keys, **kwargs)
        except Exception as e:
            err_msg = str(e)
            if "IndexKeySpecsConflict" in err_msg or "IndexOptionsConflict" in err_msg or "codeName" in err_msg:
                logger.warning(f"Index conflict on {collection.name} for keys {keys}. Existing index will NOT be dropped. Error: {e}")
            else:
                logger.warning(f"Index creation notice on {collection.name}: {e}")

    def _create_indexes(self):
        """Create all database indexes safely checking conflicts."""
        db = self.get_db()
        
        # ── Users ──
        self._ensure_index(db.users, "email", unique=True)
        self._ensure_index(db.users, "username", unique=True)
        
        # ── Books ──
        books = db.books
        self._ensure_index(books, "isbn", unique=True, sparse=True)
        self._ensure_index(books, "barcode_value", unique=True, sparse=True)
        self._ensure_index(books, "qr_value", unique=True, sparse=True)
        self._ensure_index(books, "title")
        self._ensure_index(books, "author")
        self._ensure_index(books, "genre")
        self._ensure_index(books, "is_available")
        self._ensure_index(books, "created_at")
        self._ensure_index(books, [("genre", ASCENDING), ("is_available", ASCENDING)])
        self._ensure_index(books, [("is_available", ASCENDING), ("created_at", DESCENDING)])
        self._ensure_index(books, [("title", TEXT), ("author", TEXT), ("description", TEXT)])

        # ── Students ──
        students = db.students
        self._ensure_index(students, "student_id", unique=True)
        self._ensure_index(students, "email", unique=True)
        self._ensure_index(students, "full_name")
        self._ensure_index(students, "course")
        self._ensure_index(students, "department")
        self._ensure_index(students, "is_active")
        self._ensure_index(students, [("is_active", ASCENDING), ("full_name", ASCENDING)])
        
        # ── Borrows ──
        borrows = db.borrows
        self._ensure_index(borrows, "student_id")
        self._ensure_index(borrows, "book_id")
        self._ensure_index(borrows, "status")
        self._ensure_index(borrows, "issue_date")
        self._ensure_index(borrows, "due_date")
        self._ensure_index(borrows, [("student_id", ASCENDING), ("book_id", ASCENDING), ("status", ASCENDING)])
        self._ensure_index(borrows, [("status", ASCENDING), ("due_date", ASCENDING)])
        self._ensure_index(borrows, [("issue_date", DESCENDING)])
        self._ensure_index(borrows, [("return_date", DESCENDING)], sparse=True)
        self._ensure_index(borrows, [("student_id", ASCENDING), ("issue_date", DESCENDING)])
        # P1-7: Unique partial index to prevent duplicate active borrows (same student + book)
        self._ensure_index(
            borrows,
            [("student_id", ASCENDING), ("book_id", ASCENDING)],
            unique=True,
            partialFilterExpression={"status": "issued"},
            name="unique_active_borrow"
        )

        # ── Fines ──
        fines = db.fines
        self._ensure_index(fines, "student_id")
        self._ensure_index(fines, "paid")
        self._ensure_index(fines, "created_at")
        self._ensure_index(fines, [("paid", ASCENDING), ("student_id", ASCENDING)])
        self._ensure_index(fines, [("paid", ASCENDING), ("paid_at", DESCENDING)], sparse=True)
        self._ensure_index(fines, [("created_at", DESCENDING)])

        # ── Reservations ──
        reservations = db.reservations
        self._ensure_index(reservations, [("book_id", ASCENDING), ("status", ASCENDING)])
        self._ensure_index(reservations, "student_id")
        self._ensure_index(reservations, [("book_id", ASCENDING), ("student_id", ASCENDING), ("status", ASCENDING)])
        self._ensure_index(reservations, [("status", ASCENDING), ("reserved_at", ASCENDING)])
        # P1-8: Unique partial index to prevent duplicate active reservations (same student + book)
        self._ensure_index(
            reservations,
            [("student_id", ASCENDING), ("book_id", ASCENDING)],
            unique=True,
            partialFilterExpression={"status": {"$in": ["pending", "ready"]}},
            name="unique_active_reservation"
        )

        # ── Authors ──
        self._ensure_index(db.authors, "name")
        self._ensure_index(db.authors, "status")
        self._ensure_index(db.authors, "is_deleted")
        
        # ── Categories ──
        self._ensure_index(db.categories, "name")
        self._ensure_index(db.categories, "status")
        self._ensure_index(db.categories, "is_deleted")

        # ── Notifications ──
        self._ensure_index(db.notifications, [("student_id", ASCENDING), ("read", ASCENDING)])
        self._ensure_index(db.notifications, [("created_at", DESCENDING)])

        # ── Audit Logs ──
        self._ensure_index(db.audit_logs, [("timestamp", DESCENDING)])
        self._ensure_index(db.audit_logs, "action")
        self._ensure_index(db.audit_logs, "username")
        self._ensure_index(db.audit_logs, [("action", ASCENDING), ("timestamp", DESCENDING)])

        # ── Backup History ──
        self._ensure_index(db.backup_history, [("created_at", DESCENDING)])
        
        # ── SMS Logs ──
        self._ensure_index(db.sms_logs, "recipient")
        self._ensure_index(db.sms_logs, "status")
        self._ensure_index(db.sms_logs, [("status", ASCENDING), ("dispatched_at", DESCENDING)])
        
        # ── Email Logs ──
        self._ensure_index(db.email_logs, "recipient")
        self._ensure_index(db.email_logs, "status")
        self._ensure_index(db.email_logs, [("status", ASCENDING), ("dispatched_at", DESCENDING)])
        
        logger.info("✅ All indexes created successfully")

# Singleton instance
db = Database()

# Dependency for FastAPI
def get_db():
    """FastAPI dependency for database"""
    return db.get_db()