from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.database import db_instance
from app.services.ml_service import predict_maintenance
from app.services.vin_service import vin_decoder

router = APIRouter(prefix="/api/predict", tags=["Repair Predictions"])


class PredictionRequest(BaseModel):
    vin: str
    mileage: int = Field(..., ge=0)
    driving_habits: str = "City Commute"
    owner_id: str | None = None


class VehiclePredictionRequest(BaseModel):
    owner_id: str
    mileage: int | None = Field(default=None, ge=0)


def get_vehicles_collection():
    if db_instance.db is None:
        return None
    return db_instance.db["vehicles"]


async def create_vehicle_prediction(
    vehicle: dict,
    mileage: int,
    make: str,
    model_name: str,
    year: int,
    driving_habits: str,
    vehicles_collection,
) -> dict:
    prediction_results = await predict_maintenance(
        make=make,
        model_name=model_name,
        year=year,
        mileage=mileage,
        driving_habits=driving_habits,
    )
    if prediction_results["status"] == "error":
        raise HTTPException(status_code=500, detail="Inference failed")

    generated_at = datetime.now(timezone.utc).isoformat()
    vehicle_id = str(vehicle["_id"])
    prediction_snapshot = {
        "model_version": prediction_results["model_version"],
        "mileage": mileage,
        "generated_at": generated_at,
        "upcoming_repairs": prediction_results["predictions"],
    }
    model_profile = {
        "version": prediction_results["model_version"],
        "vehicle_id": vehicle_id,
        "make": make,
        "model": model_name,
        "year": year,
        "driving_habits": driving_habits,
        "updated_at": generated_at,
    }
    await vehicles_collection.update_one(
        {"_id": vehicle["_id"]},
        {
            "$set": {
                "maintenance_model_profile": model_profile,
                "maintenance_prediction": prediction_snapshot,
            }
        },
    )
    return {
        "vehicle_id": vehicle_id,
        "vehicle": {
            "Make": make,
            "Model": model_name,
            "ModelYear": str(year),
        },
        "mileage_analyzed": mileage,
        "upcoming_repairs": prediction_results["predictions"],
        "model_version": prediction_results["model_version"],
        "generated_at": generated_at,
        "prediction": prediction_snapshot,
    }


@router.post("/")
async def get_prediction(request: PredictionRequest):
    vin = request.vin.upper().strip()
    if len(vin) != 17:
        raise HTTPException(status_code=400, detail="Invalid VIN length")

    vehicle_data = await vin_decoder.get_basic_info(vin)
    if "error" in vehicle_data or vehicle_data.get("ErrorCode") not in ["0", "1"]:
        raise HTTPException(status_code=400, detail="Failed to decode VIN")

    try:
        year = int(vehicle_data.get("ModelYear"))
    except (TypeError, ValueError):
        year = 2010

    driving_habits = request.driving_habits
    try:
        vehicles_collection = get_vehicles_collection()
        vehicle_query = {"vin": vin}
        if request.owner_id:
            vehicle_query["owner_id"] = request.owner_id.strip()
        vehicle = (
            await vehicles_collection.find_one(vehicle_query)
            if vehicles_collection is not None and request.owner_id
            else None
        )
        if vehicle:
            driving_habits = vehicle.get("driving_habits", driving_habits)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Vehicle data is unavailable.") from exc

    if vehicle and vehicles_collection is not None:
        try:
            vehicle_year = int(vehicle.get("year") or year)
        except (TypeError, ValueError):
            vehicle_year = year
        return await create_vehicle_prediction(
            vehicle=vehicle,
            mileage=request.mileage,
            make=vehicle.get("make", vehicle_data.get("Make", "Unknown")),
            model_name=vehicle.get("model", vehicle_data.get("Model", "Unknown")),
            year=vehicle_year,
            driving_habits=driving_habits,
            vehicles_collection=vehicles_collection,
        )

    prediction_results = await predict_maintenance(
        make=vehicle_data.get("Make", "Unknown"),
        model_name=vehicle_data.get("Model", "Unknown"),
        year=year,
        mileage=request.mileage,
        driving_habits=driving_habits,
    )
    if prediction_results["status"] == "error":
        raise HTTPException(status_code=500, detail="Inference failed")
    return {
        "vehicle": vehicle_data,
        "mileage_analyzed": request.mileage,
        "upcoming_repairs": prediction_results["predictions"],
        "model_version": prediction_results["model_version"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/vehicle/{vehicle_id}")
async def predict_registered_vehicle(
    vehicle_id: str,
    request: VehiclePredictionRequest,
):
    if not ObjectId.is_valid(vehicle_id):
        raise HTTPException(status_code=400, detail="Invalid vehicle ID.")
    vehicles_collection = get_vehicles_collection()
    if vehicles_collection is None:
        raise HTTPException(status_code=503, detail="Database is not connected.")

    vehicle = await vehicles_collection.find_one(
        {"_id": ObjectId(vehicle_id), "owner_id": request.owner_id.strip()}
    )
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    try:
        year = int(vehicle.get("year") or 2010)
    except (TypeError, ValueError):
        year = 2010
    mileage = request.mileage
    if mileage is None:
        mileage = int(vehicle.get("current_mileage") or 0)

    return await create_vehicle_prediction(
        vehicle=vehicle,
        mileage=mileage,
        make=vehicle.get("make", "Unknown"),
        model_name=vehicle.get("model", "Unknown"),
        year=year,
        driving_habits=vehicle.get("driving_habits", "City Commute"),
        vehicles_collection=vehicles_collection,
    )


@router.get("/vehicle/{vehicle_id}")
async def get_vehicle_prediction(vehicle_id: str, owner_id: str):
    if not ObjectId.is_valid(vehicle_id):
        raise HTTPException(status_code=400, detail="Invalid vehicle ID.")
    if db_instance.db is None:
        raise HTTPException(status_code=503, detail="Database is not connected.")

    vehicle = await db_instance.db["vehicles"].find_one(
        {"_id": ObjectId(vehicle_id), "owner_id": owner_id.strip()}
    )
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    return {
        "vehicle_id": vehicle_id,
        "model_profile": vehicle.get("maintenance_model_profile"),
        "prediction": vehicle.get("maintenance_prediction"),
    }