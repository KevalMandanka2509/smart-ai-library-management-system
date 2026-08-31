import os
import time
import urllib.error
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class GeminiKeyManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GeminiKeyManager, cls).__new__(cls)
            cls._instance._init()
        return cls._instance
        
    def _init(self):
        self.keys = []
        # Support backward compatibility
        legacy_key = os.getenv("GEMINI_API_KEY", "")
        if legacy_key and legacy_key.startswith("AIza"):
            self.keys.append({"key": legacy_key, "priority": 0})
            
        for i in range(1, 5):
            k = os.getenv(f"GEMINI_API_KEY_{i}", "")
            if k and k.startswith("AIza"):
                # Avoid duplicates
                if not any(existing["key"] == k for existing in self.keys):
                    self.keys.append({"key": k, "priority": i})
                    
        self.keys.sort(key=lambda x: x["priority"])
        
        # State tracking: key -> cooldown expiry timestamp (0 means available)
        self.cooldowns = {k["key"]: 0 for k in self.keys}
        
        try:
            self.cooldown_seconds = int(os.getenv("GEMINI_KEY_COOLDOWN_SECONDS", "60"))
        except ValueError:
            self.cooldown_seconds = 60

    def get_available_key(self) -> Optional[str]:
        now = time.time()
        for k_info in self.keys:
            k = k_info["key"]
            if self.cooldowns[k] <= now:
                return k
        return None
        
    def mark_rate_limited(self, key: str):
        self.cooldowns[key] = time.time() + self.cooldown_seconds
        logger.warning(f"Gemini key rate limited. Marked for {self.cooldown_seconds}s cooldown.")
        
    def mark_invalid(self, key: str):
        # Essentially infinite cooldown (10 years)
        self.cooldowns[key] = time.time() + (3600 * 24 * 365 * 10)
        logger.warning("Gemini key invalid/unauthorized. Marked unavailable.")
        
    def execute_with_failover(self, request_func):
        """
        Executes request_func with failover.
        request_func should take `api_key` as its only parameter.
        """
        while True:
            key = self.get_available_key()
            if not key:
                raise Exception("All Gemini API keys are currently unavailable.")
                
            try:
                return request_func(key)
            except urllib.error.HTTPError as e:
                code = e.code
                if code == 429:
                    self.mark_rate_limited(key)
                elif code in (401, 403):
                    self.mark_invalid(key)
                elif code >= 500:
                    self.mark_rate_limited(key)
                else:
                    raise e
            except Exception as e:
                error_str = str(e).lower()
                if "timeout" in error_str or "reset" in error_str or "quota" in error_str or "rate limit" in error_str:
                    self.mark_rate_limited(key)
                else:
                    raise e
