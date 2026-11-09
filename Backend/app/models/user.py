from datetime import datetime, timezone
from typing import Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = Field(..., description="Roles: consumer, diy, mechanic")
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


class ServiceEstimate(BaseModel):
    """A mechanic's estimate for one entry in services_offered."""

    name: str = Field(..., min_length=1, max_length=100)
    estimated_price: Optional[float] = Field(default=None, ge=0, le=100000)
    estimated_duration_minutes: Optional[int] = Field(
        default=None,
        ge=30,
        le=480,
        multiple_of=30,
        description="How long the appointment occupies once accepted.",
    )


class MechanicProfile(BaseModel):
    """
    Shop/business profile for a mechanic, keyed by the Firebase Auth UID.

    New profiles use structured location fields. `address` remains optional only
    so older clients/records can still be read while the project transitions.
    New saves from the current frontend use street_address/city/state/zip_code.
    """

    owner_id: str
    shop_name: str
    street_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = Field(default=None, min_length=2, max_length=2)
    zip_code: Optional[str] = Field(default=None, pattern=r"^\d{5}$")
    address: Optional[str] = None
    phone: Optional[str] = None
    services_offered: List[str] = Field(default_factory=list)
    # None means "leave saved estimates unchanged" so older clients that
    # don't send this field can't wipe them.
    service_estimates: Optional[List[ServiceEstimate]] = None
    price_per_hour: Optional[float] = Field(None, ge=0)
    operating_hours: Optional[Dict[str, str]] = None

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: Optional[str]) -> Optional[str]:
        return value.strip().upper() if value else value


class DIYPeerProfile(UserBase):
    tools_available: List[str]
    zip_code: str
    willing_to_assist: bool = True
    price_to_rent: float
    price_to_buy: Optional[float]
