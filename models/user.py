from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional 
from datetime import datetime 

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = Field(..., description = "Roles: consumer, diy_peer, mechanic")
    created_at: datatime = Field(defulat_factory = datetime.utcnow)

class MechanicProfile(UserBase):
    shop_name: str 
    address: str 
    services_offerd: List[str]
    price_per_hour: float = Field(..., gt = 0)

class DIYPeerProfile(UserBase):
    tools_available: List[str]
    zip_code: str 
    willing_to_assist: bool = True
    price_to_rent: float
    price_to_buy: Optional[float]