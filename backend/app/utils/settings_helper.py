"""
P1-11: Centralized library settings reader.
Reads from global_config settings with safe fallbacks.
"""
from typing import Optional

# Default settings matching DEFAULT_SETTINGS in settings_route.py
_DEFAULTS = {
    "max_books_per_student": 5,
    "max_reservation_days": 7,
    "allow_renewals": True,
    "max_renew_count": 2,
    "default_borrow_days": 14,
    "grace_period_days": 2,
    "auto_remind_days_before": 3,
    "block_borrow_on_unpaid_fine": True,
    "max_fine_limit_for_borrow": 20.0,
    "daily_fine_rate": 1.50,
    "max_fine_per_book": 50.00,
    "auto_generate_fines": True,
    "currency_symbol": "₹",
}


def get_library_settings(db) -> dict:
    """
    Read all library-related settings from the centralized settings collection.
    Returns a flat dict with safe fallback defaults.
    """
    result = dict(_DEFAULTS)
    try:
        config = db.settings.find_one({"_id": "global_config"})
        if config:
            # Library section
            lib = config.get("library", {})
            for key in ["max_books_per_student", "max_reservation_days", "allow_renewals", "max_renew_count"]:
                if key in lib:
                    result[key] = lib[key]

            # Borrow section
            borrow = config.get("borrow", {})
            for key in ["default_borrow_days", "grace_period_days", "auto_remind_days_before",
                         "block_borrow_on_unpaid_fine", "max_fine_limit_for_borrow"]:
                if key in borrow:
                    result[key] = borrow[key]

            # Fine section
            fine = config.get("fine", {})
            for key in ["daily_fine_rate", "max_fine_per_book", "auto_generate_fines"]:
                if key in fine:
                    result[key] = fine[key]

            # General section
            general = config.get("general", {})
            if "currency_symbol" in general:
                result["currency_symbol"] = general["currency_symbol"]
    except Exception:
        pass

    # Ensure numeric types
    result["max_books_per_student"] = int(result["max_books_per_student"])
    result["default_borrow_days"] = int(result["default_borrow_days"])
    result["grace_period_days"] = int(result["grace_period_days"])
    result["max_renew_count"] = int(result["max_renew_count"])
    result["max_reservation_days"] = int(result["max_reservation_days"])
    result["daily_fine_rate"] = float(result["daily_fine_rate"])
    result["max_fine_per_book"] = float(result["max_fine_per_book"])
    result["max_fine_limit_for_borrow"] = float(result["max_fine_limit_for_borrow"])

    return result
