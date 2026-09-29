from typing import List, Optional

from pydantic import BaseModel, Field


class MaintenanceRecord(BaseModel):
    service_date: str
    service_type: str
    parts_replaced: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class Vehicle(BaseModel):
    owner_id: str
    vin: str = Field(..., description="String representation of the User's MongoDB _id")
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    current_milage: int = Field(..., gt=0)
    maintenance_history: List[MaintenanceRecord] = Field(default_factory=list)


class VehicleCreate(Vehicle):
    pass