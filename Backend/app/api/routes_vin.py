from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.vin_service import vin_decoder
from app.core.database import db_instance

router = APIRouter(prefix="/api/vin", tags=["VIN Lookup"])

# Create a strict schema for the incoming JSON
class VinRegistrationRequest(BaseModel):
    vin: str
    owner_id: str

@router.post("/register")
async def register_and_lookup_vin(request: VinRegistrationRequest):
    """
    Decodes the VIN using the NHTSA API and saves the vehicle to the database.
    """
    vin = request.vin.upper()
    owner_id = request.owner_id
    
    if len(vin) != 17:
        raise HTTPException(status_code=400, detail="VIN must be exactly 17 characters long.")
    
    # 1. Fetch data from external API
    vehicle_data = await vin_decoder.get_basic_info(vin)
    
    # Accept "0" (Perfect VIN) or "1" (Check Digit Warning, but still decodes)
    if "error" in vehicle_data or vehicle_data.get("ErrorCode") not in ["0", "1"]:
        raise HTTPException(
            status_code=400, 
            detail=vehicle_data.get("ErrorText", "Failed to decode VIN from NHTSA.")
        )

    # 2. Format the data to match your database schema
    try:
        year = int(vehicle_data.get("ModelYear"))
    except (ValueError, TypeError):
        year = None

    new_vehicle = {
        "owner_id": owner_id,
        "vin": vin,
        "make": vehicle_data.get("Make"),
        "model": vehicle_data.get("Model"),
        "year": year,
        "current_mileage": 0 
    }

    # 3. Insert into MongoDB Atlas
    try:
        vehicles_collection = db_instance.db["vehicles"]
        existing_vehicle = await vehicles_collection.find_one({"vin": vin, "owner_id": owner_id})
        
        if existing_vehicle:
            existing_vehicle["_id"] = str(existing_vehicle["_id"])
            return {
                "message": "Vehicle already registered",
                "vehicle_id": existing_vehicle["_id"],
                "vehicle_details": existing_vehicle
            }

        result = await vehicles_collection.insert_one(new_vehicle)
        new_vehicle["_id"] = str(new_vehicle["_id"])
        
        return {
            "message": "Vehicle successfully decoded and saved",
            "vehicle_id": str(result.inserted_id),
            "vehicle_details": new_vehicle
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")