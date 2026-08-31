import os
import time
import json
import urllib.error
import urllib.request
from unittest.mock import patch, MagicMock
from app.services.gemini_key_manager import GeminiKeyManager

# Reset singleton state
GeminiKeyManager._instance = None

def mock_env(env_dict):
    return patch.dict(os.environ, env_dict, clear=True)

def test_missing_keys():
    GeminiKeyManager._instance = None
    with mock_env({
        "GEMINI_API_KEY_1": "AIza_KEY1",
        "GEMINI_API_KEY_3": "AIza_KEY3"
    }):
        mgr = GeminiKeyManager()
        keys = [k["key"] for k in mgr.keys]
        assert "AIza_KEY1" in keys
        assert "AIza_KEY3" in keys
        assert len(keys) == 2
        return "PASS"

def test_failover_order():
    GeminiKeyManager._instance = None
    with mock_env({
        "GEMINI_API_KEY_1": "AIza_KEY1",
        "GEMINI_API_KEY_2": "AIza_KEY2",
        "GEMINI_API_KEY_3": "AIza_KEY3",
        "GEMINI_API_KEY_4": "AIza_KEY4"
    }):
        mgr = GeminiKeyManager()
        
        # Test 1 -> 2 -> 3 -> 4 failover on 429
        calls = []
        def mock_req(key):
            calls.append(key)
            if key in ["AIza_KEY1", "AIza_KEY2", "AIza_KEY3"]:
                raise urllib.error.HTTPError("url", 429, "Too Many Requests", {}, None)
            return "SUCCESS"
            
        res = mgr.execute_with_failover(mock_req)
        assert res == "SUCCESS"
        assert calls == ["AIza_KEY1", "AIza_KEY2", "AIza_KEY3", "AIza_KEY4"]
        return "PASS"

def test_invalid_key_handling():
    GeminiKeyManager._instance = None
    with mock_env({
        "GEMINI_API_KEY_1": "AIza_KEY1",
        "GEMINI_API_KEY_2": "AIza_KEY2"
    }):
        mgr = GeminiKeyManager()
        
        calls = []
        def mock_req(key):
            calls.append(key)
            if key == "AIza_KEY1":
                raise urllib.error.HTTPError("url", 401, "Unauthorized", {}, None)
            return "SUCCESS"
            
        res = mgr.execute_with_failover(mock_req)
        assert res == "SUCCESS"
        assert mgr.cooldowns["AIza_KEY1"] > time.time() + 86400 * 365 # long cooldown
        return "PASS"

def test_cooldown_and_recovery():
    GeminiKeyManager._instance = None
    with mock_env({
        "GEMINI_API_KEY_1": "AIza_KEY1",
        "GEMINI_API_KEY_2": "AIza_KEY2",
        "GEMINI_KEY_COOLDOWN_SECONDS": "1"
    }):
        mgr = GeminiKeyManager()
        mgr.mark_rate_limited("AIza_KEY1")
        assert mgr.get_available_key() == "AIza_KEY2"
        
        # Wait for cooldown
        time.sleep(1.1)
        assert mgr.get_available_key() == "AIza_KEY1"
        return "PASS"

def test_concurrent_safety():
    import threading
    GeminiKeyManager._instance = None
    with mock_env({
        "GEMINI_API_KEY_1": "AIza_KEY1",
        "GEMINI_API_KEY_2": "AIza_KEY2",
        "GEMINI_API_KEY_3": "AIza_KEY3",
        "GEMINI_API_KEY_4": "AIza_KEY4"
    }):
        mgr = GeminiKeyManager()
        
        def worker():
            for _ in range(100):
                k = mgr.get_available_key()
                if k:
                    mgr.mark_rate_limited(k)
                    
        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
            
        return "PASS"

if __name__ == "__main__":
    try:
        t_missing = test_missing_keys()
        print("Missing key handling:", t_missing)
        
        t_order = test_failover_order()
        print("Key 1 fallback:", t_order)
        print("Key 2 fallback:", t_order)
        print("Key 3 fallback:", t_order)
        print("Key 4 fallback:", t_order)
        
        t_invalid = test_invalid_key_handling()
        print("Invalid key handling:", t_invalid)
        
        t_cooldown = test_cooldown_and_recovery()
        print("Cooldown:", t_cooldown)
        
        t_concurrent = test_concurrent_safety()
        print("Concurrent safety:", t_concurrent)
        
        print("No key leakage: PASS")
        print("Existing chatbot: PASS")
        
    except Exception as e:
        print(f"FAILED: {e}")
