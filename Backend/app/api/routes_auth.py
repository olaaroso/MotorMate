from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel, EmailStr, Field

from app.core.auth import authenticate_user, create_access_token, get_current_user, register_user, require_auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "consumer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class DirectPasswordReset(BaseModel):
    email: str
    verification_name: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)

@router.post("/register")
async def register(payload: RegisterRequest):
    user = register_user(payload.name, str(payload.email), payload.password, payload.role)
    token = create_access_token(user["email"])
    return {"message": "User registered successfully", "access_token": token, "token_type": "bearer", "role": user["role"]}


@router.post("/login")
async def login(payload: LoginRequest):
    user = authenticate_user(str(payload.email), payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["email"])
    return {"access_token": token, "token_type": "bearer", "role": user["role"]}


@router.get("/me")
async def me(current_user: dict = Depends(require_auth)):
    return {"email": current_user["email"], "name": current_user["name"], "role": current_user["role"]}


@router.post("/reset-password-direct")
async def reset_password_direct(payload: DirectPasswordReset):
    email = payload.email.strip().lower()
    verify_name = payload.verification_name.strip().lower()

    try:
        fb_user = firebase_auth.get_user_by_email(email)
    except Exception:
        raise HTTPException(status_code=404, detail="No account found with that email address.")

    matched = False
    if db_instance.db is not None:
        user_doc = await db_instance.db["users"].find_one({"uid": fb_user.uid})
        if user_doc:
            candidates = [
                str(user_doc.get("firstName") or ""),
                str(user_doc.get("first_name") or ""),
                str(user_doc.get("name") or ""),
                str(user_doc.get("shop_name") or ""),
            ]
            if any(c.strip().lower() == verify_name for c in candidates if c.strip()):
                matched = True

    if not matched and fb_user.display_name:
        first_part = fb_user.display_name.strip().split()[0].lower()
        if verify_name in (fb_user.display_name.strip().lower(), first_part):
            matched = True

    if not matched:
        raise HTTPException(
            status_code=403,
            detail="Verification name did not match our records for this email.",
        )

    try:
        firebase_auth.update_user(fb_user.uid, password=payload.new_password)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not update password: {str(exc)}")

    return {"message": "Password reset successfully. You can now log in with your new password."}


@router.delete("/account/{uid}")
async def delete_user_records(uid: str):
    if db_instance.db is not None:
        await db_instance.db["users"].delete_many({"uid": uid})
        await db_instance.db["vehicles"].delete_many({"owner_id": uid})
        await db_instance.db["notifications"].delete_many({"user_id": uid})
    return {"message": "User records deleted."}