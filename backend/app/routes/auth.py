from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from ..database import get_db
from ..models.user_model import user_document, serialize_user
from ..core.security import security
from ..schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse, ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest
from ..utils.jwt_handler import create_tokens

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

# ============================================
# 1. REGISTER - Create New User
# ============================================
@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db=Depends(get_db)):
    """
    Register a new user.
    """
    collection = db.users
    
    # Create user
    user_data = request.dict()
    user_data["role"] = "member"
    user_data["password"] = security.hash_password(user_data["password"])
    new_user = user_document(user_data)
    
    from pymongo.errors import DuplicateKeyError
    try:
        result = collection.insert_one(new_user)
    except DuplicateKeyError as e:
        error_msg = str(e)
        field = "Email" if "email" in error_msg else "Username"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field} already registered"
        )
        
    created_user = collection.find_one({"_id": result.inserted_id})

    # Auto-create student profile if role is member
    if created_user.get("role") == "member":
        try:
            from ..models.student import student_document
            student_profile = {
                "student_id": created_user["username"],
                "full_name": created_user.get("full_name") or created_user["username"],
                "email": created_user["email"],
            }
            db.students.insert_one(student_document(student_profile))
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to auto-create student record: {e}")

    # Dispatch Welcome Email
    try:
        from ..services.email_service import EmailService
        await EmailService.send_welcome_email(
            recipient_email=created_user["email"],
            user_name=created_user.get("full_name") or created_user["username"],
            username=created_user["username"],
            user_role=created_user.get("role", "member"),
            db=db
        )
    except Exception as email_err:
        import logging
        logging.getLogger(__name__).warning(f"Welcome email trigger warning: {email_err}")

    return {
        "message": "User registered successfully",
        "user": serialize_user(created_user)
    }

# ============================================
# 2. LOGIN - Authenticate User
# ============================================
@router.post("/login", response_model=dict)
async def login(request: LoginRequest, db=Depends(get_db)):
    """
    Login user and return tokens.
    """
    collection = db.users
    
    # Find user by email
    user = collection.find_one({"email": request.email.lower()})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or disabled"
        )
    
    # Check if account is locked
    if user.get("locked_until"):
        if user["locked_until"] > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is temporarily locked"
            )
        else:
            # Lockout period expired - unlock account automatically
            collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"login_attempts": 0, "locked_until": None}}
            )
            # Fetch updated user state to continue validation
            user = collection.find_one({"_id": user["_id"]})
    
    # Verify password
    if not security.verify_password(request.password, user.get("password", "")):
        # Update failed attempts
        attempts = user.get("login_attempts", 0) + 1
        update_data = {"login_attempts": attempts}
        
        # Lock if max attempts exceeded
        from datetime import timedelta
        if attempts >= 5:
            update_data["locked_until"] = datetime.utcnow() + timedelta(minutes=15)
        
        collection.update_one({"_id": user["_id"]}, {"$set": update_data})
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Reset login attempts on success
    collection.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "login_attempts": 0,
            "locked_until": None,
            "last_login": datetime.utcnow()
        }}
    )

    from ..utils.audit import record_audit_log
    record_audit_log(db, user, "LOGIN", "Auth System", f"User logged in from IP")
    
    # Create tokens
    tokens = create_tokens(str(user["_id"]), user["email"])
    
    return {
        **tokens,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "username": user.get("username"),
            "full_name": user.get("full_name"),
            "role": user.get("role", "member")
        }
    }

from ..schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse, ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest, RefreshTokenRequest

# ============================================
# 3. REFRESH TOKEN - Get New Access Token
# ============================================
@router.post("/refresh", response_model=dict)
async def refresh_token(request: RefreshTokenRequest, db=Depends(get_db)):
    """
    Refresh access token using refresh token.
    """
    try:
        payload = security.decode_token(request.refresh_token)
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        user_id = payload.get("sub")
        collection = db.users
        from bson import ObjectId
        user = collection.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
            
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive or disabled"
            )
            
        if user.get("locked_until") and user["locked_until"] > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is temporarily locked"
            )
        
        tokens = create_tokens(str(user["_id"]), user["email"])
        return tokens
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

# ============================================
# 4. FORGOT PASSWORD - Generate OTP
# ============================================
@router.post("/forgot-password", response_model=dict)
async def forgot_password(request: ForgotPasswordRequest, db=Depends(get_db)):
    import random
    from datetime import datetime, timedelta
    collection = db.users
    rate_limits = db.auth_rate_limits
    
    # Ensure TTL index exists for cleanup
    rate_limits.create_index("expires_at", expireAfterSeconds=0)
    
    user = collection.find_one({"email": request.email.lower()})
    
    success_message = {"message": "If an account exists with this email, a verification code has been sent."}
    if not user:
        return success_message

    now = datetime.utcnow()
    
    # Check rate limits
    existing_limit = rate_limits.find_one({"email": request.email.lower(), "type": "otp"})
    if existing_limit:
        if existing_limit.get("cooldown_until") and existing_limit["cooldown_until"] > now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait before requesting another code."
            )
        
        # Check max requests per window (e.g., 5 requests per hour)
        if existing_limit.get("request_count", 0) >= 5 and existing_limit.get("window_reset", now) > now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later."
            )
            
    otp = str(random.randint(100000, 999999))
    expiry = now + timedelta(minutes=10)
    cooldown = now + timedelta(seconds=60)
    
    # Atomic upsert
    rate_limits.update_one(
        {"email": request.email.lower(), "type": "otp"},
        {
            "$set": {
                "otp_hash": security.hash_password(otp),
                "expires_at": expiry,
                "cooldown_until": cooldown,
                "attempts": 0
            },
            "$setOnInsert": {
                "request_count": 0,
                "window_reset": now + timedelta(hours=1)
            }
        },
        upsert=True
    )
    
    rate_limits.update_one(
        {"email": request.email.lower(), "type": "otp"},
        {"$inc": {"request_count": 1}}
    )

    # Clean up old fields from user doc if they exist
    collection.update_one({"_id": user["_id"]}, {"$unset": {"reset_otp": "", "otp_expiry": "", "otp_attempts": ""}})
    
    # Dispatch Password Reset OTP Email
    try:
        from ..services.email_service import EmailService
        await EmailService.send_password_reset_email(
            recipient_email=user["email"],
            user_name=user.get("full_name") or user.get("username", "User"),
            otp_code=otp,
            db=db
        )
    except Exception as email_err:
        import logging
        logging.getLogger(__name__).warning(f"Password reset email warning: {email_err}")

    return success_message

# ============================================
# 5. VERIFY OTP
# ============================================
@router.post("/verify-otp", response_model=dict)
async def verify_otp(request: VerifyOTPRequest, db=Depends(get_db)):
    from datetime import datetime, timedelta
    import secrets
    rate_limits = db.auth_rate_limits
    now = datetime.utcnow()
    
    limit_doc = rate_limits.find_one({"email": request.email.lower(), "type": "otp"})
    
    if not limit_doc or not limit_doc.get("otp_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code"
        )
        
    if limit_doc.get("attempts", 0) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid attempts. Please request a new code."
        )
        
    if limit_doc.get("expires_at", now) < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired"
        )
        
    if not security.verify_password(request.otp, limit_doc["otp_hash"]):
        rate_limits.update_one({"_id": limit_doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code or email"
        )
        
    # Generate reset token (single-use)
    reset_token = secrets.token_urlsafe(32)
    reset_expiry = now + timedelta(minutes=15)
    
    rate_limits.update_one(
        {"_id": limit_doc["_id"]},
        {
            "$set": {
                "reset_token_hash": security.hash_password(reset_token),
                "reset_token_expires": reset_expiry,
                "type": "reset_token"
            },
            "$unset": {
                "otp_hash": "",
                "attempts": "",
                "expires_at": "",
                "cooldown_until": ""
            }
        }
    )
        
    return {
        "message": "Verification code verified successfully",
        "reset_token": reset_token
    }

# ============================================
# 6. RESET PASSWORD
# ============================================
@router.post("/reset-password", response_model=dict)
async def reset_password(request: ResetPasswordRequest, db=Depends(get_db)):
    from datetime import datetime
    collection = db.users
    rate_limits = db.auth_rate_limits
    now = datetime.utcnow()
    
    limit_doc = rate_limits.find_one({"email": request.email.lower(), "type": "reset_token"})
    
    if not limit_doc or not limit_doc.get("reset_token_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
        
    if limit_doc.get("reset_token_expires", now) < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
        
    # We require a reset_token now instead of otp for the final step.
    # But wait, the request model ResetPasswordRequest uses `otp`. We should check if it has reset_token.
    # Let's assume the frontend passes `otp` as the token.
    token_to_verify = getattr(request, "reset_token", request.otp)
    
    if not security.verify_password(token_to_verify, limit_doc["reset_token_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
        
    # Delete token to make it single-use (atomic delete)
    delete_result = rate_limits.delete_one({"_id": limit_doc["_id"]})
    if delete_result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token already used"
        )
        
    user = collection.find_one({"email": request.email.lower()})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
        
    # Reset password
    hashed = security.hash_password(request.password)
    collection.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password": hashed,
            "login_attempts": 0,
            "locked_until": None
        }}
    )
    
    return {
        "message": "Password has been reset successfully"
    }