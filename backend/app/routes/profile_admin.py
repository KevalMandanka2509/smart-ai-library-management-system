from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import base64
from bson import ObjectId

from ..database import get_db
from ..core.security import get_current_user, security
from ..core.rbac import has_permission

router = APIRouter(prefix="/api/v1", tags=["Profile & Admin Management"])

# ─────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────
class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    course: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserCreateAdmin(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: str = "librarian" # admin, librarian, member
    permissions: Optional[List[str]] = []

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        valid_roles = {"admin", "librarian", "member"}
        if v not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")
        return v

class UpdateRolePermissions(BaseModel):
    role: str
    permissions: List[str]

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        valid_roles = {"admin", "librarian", "member"}
        if v not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")
        return v

# ─────────────────────────────────────────────
# System Permissions Catalog
# ─────────────────────────────────────────────
SYSTEM_PERMISSIONS = [
    {"code": "books:read", "name": "View Books", "category": "Books"},
    {"code": "books:write", "name": "Create & Edit Books", "category": "Books"},
    {"code": "books:delete", "name": "Delete Books", "category": "Books"},
    {"code": "authors:write", "name": "Create & Edit Authors", "category": "Books"},
    {"code": "authors:delete", "name": "Delete Authors", "category": "Books"},
    {"code": "categories:write", "name": "Create & Edit Categories", "category": "Books"},
    {"code": "categories:delete", "name": "Delete Categories", "category": "Books"},
    {"code": "borrows:manage", "name": "Issue & Return Books", "category": "Circulation"},
    {"code": "fines:manage", "name": "Manage & Collect Fines", "category": "Circulation"},
    {"code": "reservations:manage", "name": "Manage Reservations", "category": "Circulation"},
    {"code": "students:manage", "name": "Manage Student Accounts", "category": "Users"},
    {"code": "reports:view", "name": "View Analytics & Reports", "category": "Analytics"},
    {"code": "contact:manage", "name": "Manage Contact Messages", "category": "Admin"},
    {"code": "notifications:manage", "name": "Manage System Notifications", "category": "Admin"},
    {"code": "profile:read", "name": "View User Profiles", "category": "Users"},
    {"code": "profile:write", "name": "Edit User Profiles", "category": "Users"},
    {"code": "admin:manage", "name": "Full System Administration", "category": "Admin"}
]

ROLE_DEFAULT_PERMISSIONS = {
    "admin": [p["code"] for p in SYSTEM_PERMISSIONS],
    "librarian": ["books:read", "books:write", "authors:write", "categories:write", "borrows:manage", "fines:manage", "reservations:manage", "students:manage", "reports:view", "contact:manage", "notifications:manage", "profile:read", "profile:write"],
    "member": ["books:read", "profile:read", "profile:write"]
}

# Audit Log Helper
def log_audit(db, user: dict, action: str, resource: str, details: str = ""):
    db.audit_logs.insert_one({
        "user_id": str(user.get("_id") or user.get("id", "")),
        "username": user.get("username", "Unknown"),
        "role": user.get("role", "member"),
        "action": action,
        "resource": resource,
        "details": details,
        "timestamp": datetime.utcnow()
    })

# ─────────────────────────────────────────────
# 1. USER PROFILE ENDPOINTS
# ─────────────────────────────────────────────
@router.get("/profile/me")
async def get_my_profile(db=Depends(get_db), current_user=Depends(get_current_user)):
    user_id = current_user.get("user_id") or current_user.get("sub") or current_user.get("id")
    user = None
    if ObjectId.is_valid(str(user_id)):
        user = db.users.find_one({"_id": ObjectId(str(user_id))})
    if not user:
        user = db.users.find_one({"email": current_user.get("email")})
    
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")

    # Fetch activity history & student record if member
    student_info = {}
    if user.get("role") == "member":
        st = db.students.find_one({"student_id": user.get("username")}) or db.students.find_one({"email": user.get("email")})
        if st:
            student_info = {
                "course": st.get("course", ""),
                "department": st.get("department", ""),
                "semester": st.get("semester", 1),
                "phone": st.get("phone", ""),
                "books_borrowed": db.borrows.count_documents({"student_id": st.get("student_id"), "status": "issued"})
            }

    # Fetch recent activity (borrows, returns, password changes)
    activities = []
    for b in db.borrows.find({"student_id": user.get("username")}).sort("issue_date", -1).limit(10):
        activities.append({
            "action": f"Borrowed '{b.get('book_title')}'",
            "timestamp": b["issue_date"].isoformat() if b.get("issue_date") else None,
            "type": "borrow"
        })
        if b.get("return_date"):
            activities.append({
                "action": f"Returned '{b.get('book_title')}'",
                "timestamp": b["return_date"].isoformat(),
                "type": "return"
            })

    # Sort combined activity
    activities.sort(key=lambda x: x["timestamp"] or "", reverse=True)


    # Fetch real active sessions
    active_sessions_cursor = db.chat_sessions.find({"user_id": str(user["_id"])})
    sessions = []
    for s in active_sessions_cursor:
        sessions.append({
            "id": str(s.get("_id")),
            "device": s.get("device", "Web Browser"),
            "ip": s.get("ip", "Unknown"),
            "last_active": s.get("last_active", datetime.utcnow()).isoformat() if isinstance(s.get("last_active"), datetime) else str(s.get("last_active", "Active now")),
            "is_current": False
        })
    if not sessions:
        sessions = [{
            "id": "sess_current",
            "device": "Web Browser (Current Session)",
            "ip": "127.0.0.1",
            "last_active": "Active now",
            "is_current": True
        }]


    return {
        "id": str(user["_id"]),
        "username": user.get("username"),
        "email": user.get("email"),
        "full_name": user.get("full_name"),
        "role": user.get("role", "member"),
        "avatar": user.get("avatar", ""),
        "phone": user.get("phone", "") or student_info.get("phone", ""),
        "permissions": user.get("permissions", ROLE_DEFAULT_PERMISSIONS.get(user.get("role", "member"), [])),
        "student_details": student_info,
        "activities": activities[:15],
        "sessions": sessions
    }

@router.put("/profile/me")
async def update_my_profile(
    payload: ProfileUpdate,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    user_id = current_user.get("user_id") or current_user.get("sub") or current_user.get("id")
    query = {"_id": ObjectId(str(user_id))} if ObjectId.is_valid(str(user_id)) else {"email": current_user.get("email")}
    
    user = db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_fields = {}
    if payload.full_name is not None:
        update_fields["full_name"] = payload.full_name
    if payload.phone is not None:
        update_fields["phone"] = payload.phone

    if update_fields:
        db.users.update_one(query, {"$set": update_fields})

    # Also update student document if exists
    if user.get("role") == "member":
        st_update = {}
        if payload.full_name is not None: st_update["full_name"] = payload.full_name
        if payload.phone is not None: st_update["phone"] = payload.phone
        if payload.course is not None: st_update["course"] = payload.course
        if payload.department is not None: st_update["department"] = payload.department
        if payload.semester is not None: st_update["semester"] = payload.semester

        if st_update:
            db.students.update_one(
                {"$or": [{"student_id": user.get("username")}, {"email": user.get("email")}]},
                {"$set": st_update}
            )

    log_audit(db, user, "UPDATE_PROFILE", "User Profile", "Updated profile details")
    return {"message": "Profile updated successfully"}

@router.post("/profile/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    from ..utils.file_validation import validate_file_magic_bytes
    contents = await validate_file_magic_bytes(file, ["image/jpeg", "image/png", "image/gif"])

    if len(contents) > 2 * 1024 * 1024: # 2MB limit
        raise HTTPException(status_code=400, detail="Avatar image size cannot exceed 2MB")

    base64_img = f"data:{file.content_type};base64," + base64.b64encode(contents).decode("utf-8")
    
    user_id = current_user.get("user_id") or current_user.get("sub") or current_user.get("id")
    query = {"_id": ObjectId(str(user_id))} if ObjectId.is_valid(str(user_id)) else {"email": current_user.get("email")}

    db.users.update_one(query, {"$set": {"avatar": base64_img}})
    return {"message": "Avatar uploaded successfully", "avatar": base64_img}

@router.post("/profile/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    user_id = current_user.get("user_id") or current_user.get("sub") or current_user.get("id")
    query = {"_id": ObjectId(str(user_id))} if ObjectId.is_valid(str(user_id)) else {"email": current_user.get("email")}
    
    user = db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not security.verify_password(payload.current_password, user.get("password", "")):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    if not security.validate_password_strength(payload.new_password):
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 8 characters long and contain at least one uppercase letter, "
                   "one lowercase letter, one number, and one special character."
        )

    new_hash = security.hash_password(payload.new_password)
    db.users.update_one(query, {"$set": {"password": new_hash}})

    log_audit(db, user, "CHANGE_PASSWORD", "User Security", "User changed account password")
    return {"message": "Password changed successfully"}

# ─────────────────────────────────────────────
# 2. ADMIN MANAGEMENT ENDPOINTS (Admin Only)
# ─────────────────────────────────────────────
@router.get("/admin/permissions")
async def get_permissions_catalog(current_user=Depends(has_permission("admin:manage"))):
    return {"permissions": SYSTEM_PERMISSIONS, "role_defaults": ROLE_DEFAULT_PERMISSIONS}

@router.get("/admin/users")
async def get_all_users_admin(
    db=Depends(get_db),
    current_user=Depends(has_permission("admin:manage"))
):
    users_cursor = db.users.find().sort("username", 1).limit(1000)
    users = []
    for u in users_cursor:
        role = u.get("role", "member")
        users.append({
            "id": str(u["_id"]),
            "username": u.get("username"),
            "email": u.get("email"),
            "full_name": u.get("full_name"),
            "role": role,
            "permissions": u.get("permissions", ROLE_DEFAULT_PERMISSIONS.get(role, [])),
            "is_active": not bool(u.get("locked_until") and u["locked_until"] > datetime.utcnow()),
            "last_login": u.get("last_login").isoformat() if isinstance(u.get("last_login"), datetime) else None,
            "created_at": u.get("created_at").isoformat() if isinstance(u.get("created_at"), datetime) else None
        })
    return users

@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
async def create_user_admin(
    payload: UserCreateAdmin,
    db=Depends(get_db),
    current_user=Depends(has_permission("admin:manage"))
):
    if db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.users.find_one({"username": payload.username.lower()}):
        raise HTTPException(status_code=400, detail="Username already taken")

    if not security.validate_password_strength(payload.password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long and contain at least one uppercase letter, "
                   "one lowercase letter, one number, and one special character."
        )

    perms = payload.permissions if payload.permissions else ROLE_DEFAULT_PERMISSIONS.get(payload.role, ["books:read"])

    doc = {
        "username": payload.username.lower(),
        "email": payload.email.lower(),
        "full_name": payload.full_name,
        "password": security.hash_password(payload.password),
        "role": payload.role,
        "permissions": perms,
        "login_attempts": 0,
        "created_at": datetime.utcnow()
    }
    res = db.users.insert_one(doc)

    log_audit(db, current_user, "CREATE_USER", f"User:{payload.username}", f"Created {payload.role} user")
    return {"message": f"User {payload.username} created successfully", "user_id": str(res.inserted_id)}

@router.put("/admin/users/{user_id}/role-permissions")
async def update_user_role_permissions(
    user_id: str,
    payload: UpdateRolePermissions,
    db=Depends(get_db),
    current_user=Depends(has_permission("admin:manage"))
):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid User ID format")

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("username") == "admin":
        raise HTTPException(status_code=400, detail="Cannot modify root admin role or permissions")

    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": payload.role, "permissions": payload.permissions}}
    )

    log_audit(
        db, current_user, "ASSIGN_PERMISSIONS", f"User:{user.get('username')}",
        f"Updated role to {payload.role} with {len(payload.permissions)} permissions"
    )
    return {"message": "User role and permissions updated successfully"}

class UserUpdateAdmin(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

@router.put("/admin/users/{user_id}")
async def update_user_admin(
    user_id: str,
    payload: UserUpdateAdmin,
    db=Depends(get_db),
    current_user=Depends(has_permission("admin:manage"))
):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid User ID format")

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Cannot modify the root admin via this endpoint to downgrade
    if user.get("username") == "admin":
        if payload.email or payload.password:
            raise HTTPException(status_code=400, detail="Cannot modify root admin credentials via this endpoint")

    update_fields = {}
    if payload.full_name is not None:
        update_fields["full_name"] = payload.full_name
        
    if payload.email is not None and payload.email.lower() != user.get("email"):
        if db.users.find_one({"email": payload.email.lower()}):
            raise HTTPException(status_code=400, detail="Email already registered")
        update_fields["email"] = payload.email.lower()
        
    if payload.password:
        if not security.validate_password_strength(payload.password):
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters long and contain at least one uppercase letter, "
                       "one lowercase letter, one number, and one special character."
            )
        update_fields["password"] = security.hash_password(payload.password)

    if update_fields:
        db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_fields})
        log_audit(db, current_user, "UPDATE_USER", f"User:{user.get('username')}", "Updated user details")
        
    return {"message": "User updated successfully"}

@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_admin(
    user_id: str,
    db=Depends(get_db),
    current_user=Depends(has_permission("admin:manage"))
):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid User ID format")

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get("username") == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the root admin account")
        
    if str(user.get("_id")) == str(current_user.get("_id")):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Soft delete: move to recycle bin
    db.recycle_bin.insert_one({
        "original_collection": "users",
        "record": user,
        "deleted_at": datetime.utcnow(),
        "deleted_by": current_user.get("username", "admin"),
        "display_name": user.get("username", "Unknown User")
    })
    
    db.users.delete_one({"_id": ObjectId(user_id)})
    
    # Also delete associated student record if it exists
    student = db.students.find_one({"student_id": user.get("username")})
    if student:
        db.recycle_bin.insert_one({
            "original_collection": "students",
            "record": student,
            "deleted_at": datetime.utcnow(),
            "deleted_by": current_user.get("username", "admin"),
            "display_name": student.get("full_name", user.get("username"))
        })
        db.students.delete_one({"student_id": user.get("username")})

    log_audit(db, current_user, "DELETE_USER", f"User:{user.get('username')}", "Deleted user and associated records")
    return None

@router.get("/admin/audit-logs")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
    current_user=Depends(has_permission("admin:manage"))
):
    total = db.audit_logs.count_documents({})
    skip = (page - 1) * page_size
    cursor = db.audit_logs.find().sort("timestamp", -1).skip(skip).limit(page_size)

    logs = []
    for log in cursor:
        logs.append({
            "id": str(log["_id"]),
            "username": log.get("username", "System"),
            "role": log.get("role", "admin"),
            "action": log.get("action", ""),
            "resource": log.get("resource", ""),
            "details": log.get("details", ""),
            "timestamp": log["timestamp"].isoformat() if isinstance(log.get("timestamp"), datetime) else str(log.get("timestamp", ""))
        })

    return {
        "logs": logs,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size))
    }
