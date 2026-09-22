from pydantic import BaseModel, Field
from typing import Optional 

class Vehicle(BaseModel):
    owner_id: str
    vin: str = Field(..., description = " String representation of the User's MongoDB _id")
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    current_milage: int = Field(..., gt = 0)

class VehicleCreate(Vehicle):
    pass