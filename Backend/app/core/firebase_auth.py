import logging
from threading import Lock
from typing import Annotated

import firebase_admin
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

from app.core.config import settings

logger = logging.getLogger("vehicle_api")
bearer_scheme = HTTPBearer(auto_error=False)
app_lock = Lock()
app_name = "motormate"


def authentication_required(detail: str = "Authentication required.") -> HTTPException:
    return HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})


def _firebase_app():
    with app_lock:
        try:
            return firebase_admin.get_app(app_name)
        except ValueError:
            path = settings.FIREBASE_SERVICE_ACCOUNT_PATH.strip()
            if not path:
                raise HTTPException(503, "Server authentication is not configured.")
            try:
                return firebase_admin.initialize_app(credentials.Certificate(path), name=app_name)
            except Exception:
                logger.error("Could not initialize Firebase Admin.")
                raise HTTPException(503, "Server authentication is unavailable.") from None


def firebase_uid(user: dict | None) -> str:
    uid = user.get("uid") if isinstance(user, dict) else None
    if not isinstance(uid, str) or not uid or uid != uid.strip():
        raise authentication_required()
    return uid


def optional_firebase_user(
    authorization: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict | None:
    if authorization is None:
        return None
    app = _firebase_app()
    try:
        user = auth.verify_id_token(authorization.credentials, app=app)
    except auth.CertificateFetchError:
        raise HTTPException(503, "Server authentication is unavailable.") from None
    except (ValueError, auth.InvalidIdTokenError):
        raise authentication_required("Invalid or expired authentication token.") from None
    firebase_uid(user)
    return user


def require_firebase_user(
    user: Annotated[dict | None, Depends(optional_firebase_user)],
) -> dict:
    firebase_uid(user)
    return user


def require_matching_uid(claimed_uid: str, user: dict | None) -> str:
    uid = firebase_uid(user)
    claimed_uid = claimed_uid.strip()
    if not claimed_uid:
        raise HTTPException(400, "User ID is required.")
    if claimed_uid != uid:
        raise HTTPException(403, "You are not authorized to act as this user.")
    return uid
