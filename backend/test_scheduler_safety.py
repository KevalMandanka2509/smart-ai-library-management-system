import pytest
import asyncio
from pymongo import MongoClient
import os
from datetime import datetime, timedelta
import uuid

mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
db_client = MongoClient(mongo_uri)
test_db = db_client["test_smart_library"]

async def simulated_worker(worker_id, job_id):
    from app.services.scheduler_service import acquire_lock, release_lock
    # Try to acquire lock
    lock = acquire_lock(test_db, job_id, worker_id, ttl_seconds=5)
    if lock:
        # Simulate work
        await asyncio.sleep(0.5)
        # Release lock
        release_lock(test_db, job_id, worker_id)
        return True
    return False

@pytest.mark.asyncio
async def test_scheduler_multi_worker_lock():
    job_id = "test_job_1"
    
    # Cleanup
    test_db.scheduler_locks.delete_many({"job_id": job_id})
    
    # Simulate 3 workers starting at the same time
    results = await asyncio.gather(
        simulated_worker("worker_1", job_id),
        simulated_worker("worker_2", job_id),
        simulated_worker("worker_3", job_id),
    )
    
    # Only one should have succeeded
    success_count = sum(1 for r in results if r)
    assert success_count == 1
    
    # Test lease expiration
    # Manually insert expired lock
    test_db.scheduler_locks.update_one(
        {"job_id": "test_job_2"},
        {"$set": {
            "owner_id": "crashed_worker",
            "acquired_at": datetime.utcnow() - timedelta(minutes=10),
            "expires_at": datetime.utcnow() - timedelta(minutes=5)
        }},
        upsert=True
    )
    
    results2 = await asyncio.gather(
        simulated_worker("worker_4", "test_job_2"),
        simulated_worker("worker_5", "test_job_2")
    )
    
    assert sum(1 for r in results2 if r) == 1

if __name__ == "__main__":
    pytest.main(["-v", __file__])
