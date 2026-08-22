import pytest
from app.database import db
from pymongo import MongoClient
import os

def test_index_initializer_idempotent():
    # Run once
    db._create_indexes()
    
    # Run twice
    db._create_indexes()
    
    # Check if indexes exist
    indexes = list(db.get_db().books.list_indexes())
    assert len(indexes) > 1

if __name__ == "__main__":
    pytest.main(["-v", __file__])
