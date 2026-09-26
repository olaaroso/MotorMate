from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

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
