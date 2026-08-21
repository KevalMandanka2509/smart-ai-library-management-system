from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.security import get_current_user
from app.config import settings
import urllib.request
import json
import uuid
import asyncio
import logging
import base64
from datetime import datetime
import re

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/ai",
    tags=["AI Chatbot"]
)

class ChatMessage(BaseModel):
    role: str # 'user' or 'model'
    text: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    metadata: dict

def get_db_fallback_response(message: str, db_client, role: str, username: str, contents: list = None) -> str:
    from app.services.ai_intent_engine import process_chat_query
    return process_chat_query(message, db_client, role, username, contents)

def stream_gemini_api_sync(contents: list, system_instruction: str = None, session_id: str = None, user_id: str = None, user_text: str = None, pymongo_db=None, role: str = None, username: str = None):
    api_key = settings.GEMINI_API_KEY
    # Google Gemini keys must start with 'AIza'
    is_invalid_key = not api_key or api_key == "<YOUR_GEMINI_API_KEY>" or not api_key.startswith("AIza")
    if is_invalid_key:
        if pymongo_db is not None and role and username and user_text:
            mock_msg = get_db_fallback_response(user_text, pymongo_db, role, username, contents)
        else:
            mock_msg = "AI service is currently unavailable. Please try again later."
            
        yield mock_msg
        full_response = mock_msg
        # Keep the session saving logic running for mock responses
        if user_id and session_id and user_text and full_response:
            try:
                from app.database import db
                db_client = db.get_db()
                if db_client is not None:
                    db_client.ai_chat_sessions.update_one(
                        {"session_id": session_id},
                        {
                            "$set": {"user_id": str(user_id), "updated_at": datetime.utcnow()},
                            "$push": {
                                "messages": {
                                    "$each": [
                                        {"role": "user", "text": user_text, "timestamp": datetime.utcnow()},
                                        {"role": "model", "text": full_response, "timestamp": datetime.utcnow()}
                                    ]
                                }
                            }
                        },
                        upsert=True
                    )
            except Exception as e:
                logger.error(f"Failed to save chat session to DB: {e}")
        return

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key={api_key}"
    
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 800,
        }
    }
    
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    full_response = ""
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            for line in response:
                line_str = line.decode('utf-8').strip()
                if line_str.startswith('data: '):
                    data_str = line_str[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        if 'candidates' in data and len(data['candidates']) > 0:
                            parts = data['candidates'][0].get('content', {}).get('parts', [])
                            text = "".join(part.get('text', '') for part in parts)
                            if text:
                                full_response += text
                                yield text
                    except Exception as e:
                        logger.error(f"Failed parsing chunk: {e}")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print("IN HTTP ERROR BLOCK!", e.code)
        logger.error(f"Gemini API HTTP error {e.code}: {error_body}")
        if pymongo_db is not None and role and username and user_text:
            print("DB FALLBACK REACHED HTTP ERROR!")
            full_response = get_db_fallback_response(user_text, pymongo_db, role, username, contents)
            yield full_response
        else:
            print("FALLBACK REACHED HTTP ERROR, NO DB!")
            full_response = "AI service is currently unavailable. Please try again later."
            yield full_response
    except Exception as e:
        print("IN GENERAL EXCEPTION BLOCK!", e)
        logger.error(f"Gemini API stream failed: {e}")
        if pymongo_db is not None and role and username and user_text:
            full_response = get_db_fallback_response(user_text, pymongo_db, role, username, contents)
            yield full_response
        else:
            full_response = "AI service is currently unavailable. Please try again later."
            yield full_response
    finally:
        if user_id and session_id and user_text and full_response:
            try:
                from app.database import db
                db_client = db.get_db()
                if db_client is not None:
                    db_client.ai_chat_sessions.update_one(
                        {"session_id": session_id},
                        {
                            "$set": {"user_id": str(user_id), "updated_at": datetime.utcnow()},
                            "$push": {
                                "messages": {
                                    "$each": [
                                        {"role": "user", "text": user_text, "timestamp": datetime.utcnow()},
                                        {"role": "model", "text": full_response, "timestamp": datetime.utcnow()}
                                    ]
                                }
                            }
                        },
                        upsert=True
                    )
            except Exception as e:
                logger.error(f"Failed to save chat session to DB: {e}")

from app.database import db
from fastapi import UploadFile, File, Form
from fastapi.responses import StreamingResponse

@router.post("/chat")
async def chat_with_ai(
    message: str = Form(...),
    history: str = Form("[]"),
    session_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    try:
        import json
        history_list = json.loads(history)
        parsed_history = [ChatMessage(**msg) for msg in history_list]
        
        # Bounded history: keep only last 10 messages (5 turns)
        bounded_history = parsed_history[-10:] if parsed_history else []
        
        # P1-18: Session scoping validation
        pymongo_db = db.get_db()
        user_id = current_user.get('_id')
        if session_id and pymongo_db is not None:
            session = pymongo_db.ai_chat_sessions.find_one({"session_id": session_id})
            if session and session.get("user_id") != str(user_id):
                raise HTTPException(status_code=403, detail="Not authorized to access this chat session")
        
        # P1-18: Message length limit
        if len(message) > 1000:
            raise HTTPException(status_code=400, detail="Message too long. Please keep it under 1000 characters.")
        
        # Lightweight greeting handling
        clean_msg = message.lower().strip()
        greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"]
        if clean_msg in greetings:
            async def greeting_stream():
                full_response = "Hello! 👋 How can I help you with the library today?"
                yield full_response
                # Save greeting session
                if current_user.get('_id') and message:
                    try:
                        from app.database import db
                        db_client = db.get_db()
                        if db_client is not None:
                            db_client.ai_chat_sessions.update_one(
                                {"session_id": session_id or str(uuid.uuid4())},
                                {
                                    "$set": {"user_id": str(current_user.get('_id')), "updated_at": datetime.utcnow()},
                                    "$push": {
                                        "messages": {
                                            "$each": [
                                                {"role": "user", "text": message, "timestamp": datetime.utcnow()},
                                                {"role": "model", "text": full_response, "timestamp": datetime.utcnow()}
                                            ]
                                        }
                                    }
                                },
                                upsert=True
                            )
                    except Exception as e:
                        logger.error(f"Failed to save greeting session to DB: {e}")

            headers = {
                "X-Session-ID": session_id or str(uuid.uuid4()),
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
            return StreamingResponse(
                greeting_stream(), 
                media_type="text/plain",
                headers=headers
            )
              # Build Context based on User Role and Intent
        role = current_user.get('role', 'member')
        username = current_user.get('username')
        
        # Format history for AIIntentEngine
        hist_dicts = []
        for msg in bounded_history:
            hist_dicts.append({"role": msg.role, "parts": [{"text": msg.text}]})
            
        # Call AIIntentEngine as the ONLY authoritative router
        from app.services.ai_intent_engine import process_chat_query
        final_response = process_chat_query(message, pymongo_db, role, username, hist_dicts)
        
        sess_id = session_id or str(uuid.uuid4())
        
        # Save session to DB
        if pymongo_db is not None and user_id:
            try:
                pymongo_db.ai_chat_sessions.update_one(
                    {"session_id": sess_id},
                    {
                        "$set": {"user_id": str(user_id), "updated_at": datetime.utcnow()},
                        "$push": {
                            "messages": {
                                "$each": [
                                    {"role": "user", "text": message, "timestamp": datetime.utcnow()},
                                    {"role": "model", "text": final_response, "timestamp": datetime.utcnow()}
                                ]
                            }
                        }
                    },
                    upsert=True
                )
            except Exception as e:
                logger.error(f"Failed to save chat session to DB: {e}")
                
        async def response_stream():
            yield final_response

        headers = {
            "X-Session-ID": sess_id,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
        
        return StreamingResponse(
            response_stream(), 
            media_type="text/plain",
            headers=headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unhandled error in AI chat setup: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
async def get_chat_sessions(current_user: dict = Depends(get_current_user)):
    try:
        from app.database import db
        db_client = db.get_db()
        if db_client is None:
            return []
            
        sessions = list(db_client.ai_chat_sessions.find(
            {"user_id": str(current_user.get('_id'))},
            {"_id": 0}
        ).sort("updated_at", -1).limit(10))
        
        for session in sessions:
            if "updated_at" in session:
                session["updated_at"] = session["updated_at"].isoformat()
            for msg in session.get("messages", []):
                if "timestamp" in msg:
                    msg["timestamp"] = msg["timestamp"].isoformat()
                    
        return sessions
    except Exception as e:
        logger.error(f"Failed to fetch chat sessions: {e}")
        return []

@router.get("/status")
async def get_ai_status():
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key == "<YOUR_GEMINI_API_KEY>" or not api_key.startswith("AIza"):
        return {"status": "db_mode"}
    return {"status": "online"}
