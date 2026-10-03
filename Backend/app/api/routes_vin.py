from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import db_instance
from app.services.vin_service import vin_decoder


router = APIRouter(
    prefix="/api/vin",
    tags=["VIN Lookup"],
)


class VinRegistrationRequest(BaseModel):
    vin: str
    owner_id: str
    current_mileage: Optional[int] = 0


class ManualVehicleRequest(BaseModel):
    owner_id: str
    make: str
    model: str
    year: int
    current_mileage: Optional[int] = 0
    vin: Optional[str] = None


def get_vehicles_collection():
    if db_instance.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected.",
        )

    return db_instance.db["vehicles"]


# =========================================================
# REGISTER VEHICLE BY VIN
# =========================================================

@router.post("/register")
async def register_and_lookup_vin(
    request: VinRegistrationRequest,
):
    vin = request.vin.upper().strip()
    owner_id = request.owner_id.strip()

    if not owner_id:
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    if len(vin) != 17:
        raise HTTPException(
            status_code=400,
            detail="VIN must be exactly 17 characters long.",
        )

    vehicle_data = await vin_decoder.get_basic_info(vin)

    if (
        "error" in vehicle_data
        or vehicle_data.get("ErrorCode") not in ["0", "1"]
    ):
        raise HTTPException(
            status_code=400,
            detail=vehicle_data.get(
                "ErrorText",
                "Failed to decode VIN from NHTSA.",
            ),
        )

    try:
        year = int(vehicle_data.get("ModelYear"))
    except (TypeError, ValueError):
        year = None

    new_vehicle = {
        "owner_id": owner_id,
        "vin": vin,
        "make": vehicle_data.get("Make"),
        "model": vehicle_data.get("Model"),
        "year": year,
        "current_mileage": request.current_mileage or 0,
    }

    try:
        vehicles_collection = get_vehicles_collection()

        existing_vehicle = await vehicles_collection.find_one(
            {
                "vin": vin,
                "owner_id": owner_id,
            }
        )

        if existing_vehicle:
            existing_vehicle["_id"] = str(
                existing_vehicle["_id"]
            )

            return {
                "message": "Vehicle already registered",
                "vehicle_id": existing_vehicle["_id"],
                "vehicle_details": existing_vehicle,
            }

        result = await vehicles_collection.insert_one(
            new_vehicle
        )

        new_vehicle["_id"] = str(result.inserted_id)

        return {
            "message": "Vehicle successfully decoded and saved",
            "vehicle_id": str(result.inserted_id),
            "vehicle_details": new_vehicle,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database insertion failed: {str(exc)}",
        )


# =========================================================
# MANUAL VEHICLE
# =========================================================

@router.post("/manual")
async def register_manual_vehicle(
    request: ManualVehicleRequest,
):
    owner_id = request.owner_id.strip()
    make = request.make.strip().title()
    model = request.model.strip().title()

    if not owner_id:
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    if not make or not model:
        raise HTTPException(
            status_code=400,
            detail="Make and Model are required.",
        )

    if request.year < 1900 or request.year > 2100:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid model year.",
        )

    new_vehicle = {
        "owner_id": owner_id,
        "vin": (
            request.vin.upper().strip()
            if request.vin
            else None
        ),
        "make": make,
        "model": model,
        "year": request.year,
        "current_mileage": request.current_mileage or 0,
    }

    try:
        vehicles_collection = get_vehicles_collection()

        result = await vehicles_collection.insert_one(
            new_vehicle
        )

        new_vehicle["_id"] = str(result.inserted_id)

        return {
            "message": "Vehicle successfully added manually",
            "vehicle_id": str(result.inserted_id),
            "vehicle_details": new_vehicle,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database insertion failed: {str(exc)}",
        )


# =========================================================
# GET USER VEHICLES
# =========================================================

@router.get("/vehicles/{owner_id}")
async def get_user_vehicles(owner_id: str):
    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    try:
        vehicles_collection = get_vehicles_collection()

        vehicles = []

        cursor = vehicles_collection.find(
            {
                "owner_id": owner_id,
            }
        )

        async for vehicle in cursor:
            vehicle["_id"] = str(vehicle["_id"])
            vehicles.append(vehicle)

        return {
            "count": len(vehicles),
            "vehicles": vehicles,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve vehicles: {str(exc)}",
        )


# =========================================================
# DELETE VEHICLE
# =========================================================

@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: str,
    owner_id: str,
):
    if not ObjectId.is_valid(vehicle_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid vehicle ID.",
        )

    try:
        vehicles_collection = get_vehicles_collection()

        result = await vehicles_collection.delete_one(
            {
                "_id": ObjectId(vehicle_id),
                "owner_id": owner_id,
            }
        )

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Vehicle not found.",
            )

        return {
            "message": "Vehicle removed successfully.",
            "vehicle_id": vehicle_id,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove vehicle: {str(exc)}",
        )