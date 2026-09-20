from fastapi import APIRouter
from services.vin_service import decode_vin

router = APIRouter()

@router.get("/decode/{vin}")
async def get_vehicle_specs(vin: str):
    return await decode_vin(vin)