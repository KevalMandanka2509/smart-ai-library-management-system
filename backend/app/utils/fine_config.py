"""
Centralized fine configuration reader.
Reads from global_config settings with a safe fallback.
"""

DEFAULT_DAILY_FINE_RATE = 1.50
DEFAULT_MAX_FINE_PER_BOOK = 50.00


def get_fine_rate(db) -> float:
    """
    Read the daily fine rate from the centralized settings collection.
    Falls back to DEFAULT_DAILY_FINE_RATE if not configured.
    """
    try:
        config = db.settings.find_one({"_id": "global_config"})
        if config and "fine" in config:
            return float(config["fine"].get("daily_fine_rate", DEFAULT_DAILY_FINE_RATE))
    except Exception:
        pass
    return DEFAULT_DAILY_FINE_RATE


def get_max_fine_per_book(db) -> float:
    """
    Read the max fine per book cap from centralized settings.
    Falls back to DEFAULT_MAX_FINE_PER_BOOK if not configured.
    """
    try:
        config = db.settings.find_one({"_id": "global_config"})
        if config and "fine" in config:
            return float(config["fine"].get("max_fine_per_book", DEFAULT_MAX_FINE_PER_BOOK))
    except Exception:
        pass
    return DEFAULT_MAX_FINE_PER_BOOK
