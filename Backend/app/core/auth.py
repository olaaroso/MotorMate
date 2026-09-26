import hashlib
import os
import secrets
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SECRET_KEY = os.getenv("APP_SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)
USER_STORE: Dict[str, Dict[str, Any]] = {}


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def register_user(name: str, email: str, password: str, role: str) -> Dict[str, Any]:
    normalized_email = email.lower().strip()
    if normalized_email in USER_STORE:
        raise HTTPException(status_code=409, detail="User already exists")

    user = {
        "name": name,
        "email": normalized_email,
        "password_hash": _hash_password(password),
        "role": role,
    }
    USER_STORE[normalized_email] = user
    return user


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    user = USER_STORE.get(email.lower().strip())
    if not user:
        return None
    if user["password_hash"] != _hash_password(password):
        return None
    return user


TOKEN_STORE: Dict[str, Dict[str, Any]] = {}


def create_access_token(email: str) -> str:
    token = secrets.token_urlsafe(32)
    TOKEN_STORE[token] = {"email": email.lower().strip()}
    return token


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if credentials is None or not credentials.scheme.lower() == "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    token = credentials.credentials
    user_payload = TOKEN_STORE.get(token)
    if not user_payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    email = user_payload["email"]
    user = USER_STORE.get(email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_role(*allowed_roles: str):
    def dependency(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user.get("role") not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


def require_auth(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return user
