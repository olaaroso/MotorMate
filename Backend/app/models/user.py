from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timezone

# TODO: Implement a user authentication and authorization system to ensure that only authorized users can access certain endpoints. This will involve creating a secure login mechanism, managing user sessions, and enforcing role-based access control to protect sensitive data and functionality within the application.
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = Field(..., description="Roles: consumer, diy_peer, mechanic")
    # Use timezone.utc instead of the deprecated utcnow
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MechanicProfile(UserBase):
    shop_name: str 
    address: str 
    services_offered: List[str]
    price_per_hour: float = Field(..., gt = 0)

class DIYPeerProfile(UserBase):
    tools_available: List[str]
    zip_code: str 
    willing_to_assist: bool = True
    price_to_rent: float
    price_to_buy: Optional[float]