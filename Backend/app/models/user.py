from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = Field(..., description="Roles: consumer, d
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def permissions(self) -> set[str]:
        role_permissions = {
            "consumer": {"read:vehicles", "read:predictions"},
            "diy_peer": {"read:vehicles", "write:listings", "read:marketplace"},
            "mechanic": {"read:vehicles", "read:marketplace", "write:mechanic_profile"},
        }
        return role_permissions.get(self.role, {"read:vehicles"})

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions


class MechanicProfile(UserBase):
    shop_name: str
    address: str
    services_offered: List[str]
    price_per_hour: float = Field(..., gt=0)
    rating: float = Field(default=5.0, ge=0, le=5)


class DIYPeerProfile(UserBase):
    tools_available: List[str]
    zip_code: str
    willing_to_assist: bool = True
    price_to_rent: float
    price_to_buy: Optional[float]