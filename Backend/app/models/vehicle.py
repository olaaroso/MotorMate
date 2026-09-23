from pydantic import BaseModel, Field
from typing import Optional 

class Vehicle(BaseModel):
    owner_id: str
    vin: str = Field(..., description = " String representation of the User's MongoDB _id")
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    current_milage: int = Field(..., gt = 0)

# TODO: Add a field for the vehicle's maintenance history, which can be a list of maintenance records. Each record can include details such as the date of service, type of service performed, and any parts replaced. This will allow users to keep track of their vehicle's maintenance history and provide valuable information for future repairs or resale value.
class VehicleCreate(Vehicle):
    pass