from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datatime import datetime

class Location(BaseModel):
    type: str = "Point"
    address: str 
    city: str
    state: str
    zip_code: str

class OperatingHours(BaseModel):
    open_time: str = Field(..., example = "08:00")
    close_time: str = Field(..., example = "18:00")

class Mechanic(BaseModel):
    name: str 
    email: EmailStr 
    location: Location 
    operating_hours: OperatingHours
    services_offered: List[str]
    price_per_hour: float = Field(..., gt = 0, description = "Hourly labour rate")

