from typing import List, Optional

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    vin: str = Field(..., min_length=17, max_length=17)
    mileage: int = Field(..., ge=0)


class PredictionItem(BaseModel):
    part: str
    probability: float
    estimated_cost: int


class PredictionResponse(BaseModel):
    status: str
    predictions: List[PredictionItem]
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None