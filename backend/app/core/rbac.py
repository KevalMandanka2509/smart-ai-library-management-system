from fastapi import HTTPException, status, Depends, Request
from .security import Security, get_current_user

# Centralized RBAC System Permissions
SYSTEM_PERMISSIONS = [
    "books:read",
    "books:write",
    "books:delete",
    "authors:write",
    "authors:delete",
    "categories:write",
    "categories:delete",
    "borrows:manage",
    "fines:manage",
    "reservations:manage",
    "students:manage",
    "reports:view",
    "contact:manage",
    "notifications:manage",
    "profile:read",
    "profile:write",
    "admin:manage"
]

# Default standard role permissions mapping
ROLE_PERMISSIONS = {
    "admin": SYSTEM_PERMISSIONS,
    "librarian": [
        "books:read", 
        "books:write",
        "authors:write",
        "categories:write",
        "borrows:manage", 
        "fines:manage", 
        "reservations:manage", 
        "students:manage", 
        "reports:view",
        "contact:manage",
        "notifications:manage",
        "profile:read",
        "profile:write"
    ],
    "member": [
        "books:read",
        "profile:read",
        "profile:write"
    ]
}

def has_permission(required_permission: str):
    """
    Dependency generator for route-level authorization.
    Verifies if the current user possesses the required permission.
    """
    async def permission_checker(request: Request, user=Depends(get_current_user)):
        client_ip = request.client.host if request and request.client else "unknown"
        user_id = str(user.get("_id", "unknown"))
        role = user.get("role", "member")
        
        # 1. Check if user has explicit custom permissions assigned
        user_permissions = user.get("permissions")
        
        # 2. Fallback to default role-based permissions if explicit permissions aren't set
        if not user_permissions:
            user_permissions = ROLE_PERMISSIONS.get(role, ["books:read"])
            
        if required_permission not in user_permissions:
            Security.audit_log("RBAC_AUTHORIZATION", f"DENIED:{required_permission}", user_id, client_ip)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Requires '{required_permission}' access."
            )
            
        Security.audit_log("RBAC_AUTHORIZATION", f"GRANTED:{required_permission}", user_id, client_ip)
        return user
        
    return permission_checker
