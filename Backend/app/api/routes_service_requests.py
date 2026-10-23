from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from app.core.database import db_instance
from app.models.appointment import ServiceRequestCreate

router = APIRouter(
    prefix="/api/service-requests",
    tags=["Service Requests"],
)


# =========================================================
# DATABASE HELPERS
# =========================================================


def get_collection(name: str):
    if db_instance.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected.",
        )

    return db_instance.db[name]


def serialize_mongo_document(document: dict):
    document["id"] = str(document["_id"])
    document.pop("_id", None)
    return document


# =========================================================
# CREATE SERVICE REQUEST
# =========================================================


@router.post("")
async def create_service_request(payload: ServiceRequestCreate):
    """
    Creates a pending request for one of a mechanic's appointment slots.

    The mechanic, shop details and appointment date/time come from the
    slot and profile in the database, so they cannot be supplied or
    changed by the customer. Submitting a request does not change the
    slot; it stays "available" until a mechanic accepts a request.
    """
    customer_id = payload.customer_id.strip()
    customer_name = payload.customer_name.strip()
    service_requested = payload.service_requested.strip()
    problem_description = payload.problem_description.strip()

    if not customer_id:
        raise HTTPException(status_code=400, detail="customer_id is required.")

    if not customer_name:
        raise HTTPException(status_code=400, detail="customer_name is required.")

    if not service_requested:
        raise HTTPException(status_code=400, detail="Choose the service you need.")

    if len(problem_description) < 10:
        raise HTTPException(
            status_code=400,
            detail="Describe the problem in at least 10 characters.",
        )

    if not ObjectId.is_valid(payload.slot_id):
        raise HTTPException(status_code=400, detail="Invalid appointment slot ID.")

    if not ObjectId.is_valid(payload.vehicle_id):
        raise HTTPException(status_code=400, detail="Invalid vehicle ID.")

    slots_collection = get_collection("mechanic_availability_slots")
    mechanics_collection = get_collection("mechanics")
    vehicles_collection = get_collection("vehicles")
    requests_collection = get_collection("service_requests")

    try:
        slot = await slots_collection.find_one({"_id": ObjectId(payload.slot_id)})

        if not slot:
            raise HTTPException(
                status_code=404,
                detail="This appointment slot no longer exists.",
            )

        if slot.get("status") != "available":
            raise HTTPException(
                status_code=409,
                detail="This appointment slot is no longer available.",
            )

        slot_date = str(slot.get("date", ""))
        slot_time = str(slot.get("time", ""))

        # Server-local time; fine for local dev, but a deployed server
        # would need the shop's time zone for same-day comparisons.
        now = datetime.now()
        today = now.date().isoformat()
        current_time = now.strftime("%H:%M")

        if slot_date < today or (slot_date == today and slot_time <= current_time):
            raise HTTPException(
                status_code=409,
                detail="This appointment slot is in the past.",
            )

        mechanic_id = str(slot.get("owner_id", "")).strip()

        mechanic = (
            await mechanics_collection.find_one({"owner_id": mechanic_id})
            if mechanic_id
            else None
        )

        if not mechanic:
            raise HTTPException(
                status_code=404,
                detail="The mechanic for this appointment slot was not found.",
            )

        if mechanic_id == customer_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot request an appointment at your own shop.",
            )

        vehicle = await vehicles_collection.find_one(
            {
                "_id": ObjectId(payload.vehicle_id),
                "owner_id": customer_id,
            }
        )

        if not vehicle:
            raise HTTPException(
                status_code=404,
                detail="Vehicle not found in your garage.",
            )

        # One pending request per customer per slot, regardless of vehicle.
        existing_request = await requests_collection.find_one(
            {
                "customer_id": customer_id,
                "slot_id": payload.slot_id,
                "status": "pending",
            }
        )

        if existing_request:
            raise HTTPException(
                status_code=409,
                detail="You already have a pending request for this appointment.",
            )

        request_document = {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "mechanic_id": mechanic_id,
            "shop_name": mechanic.get("shop_name", "MotorMate Mechanic"),
            "shop_address": mechanic.get("address", ""),
            "vehicle_id": payload.vehicle_id,
            "vehicle_summary": {
                "year": vehicle.get("year") or vehicle.get("ModelYear"),
                "make": vehicle.get("make") or vehicle.get("Make"),
                "model": vehicle.get("model") or vehicle.get("Model"),
                "vin": vehicle.get("vin"),
                "current_mileage": vehicle.get("current_mileage"),
            },
            "slot_id": payload.slot_id,
            "appointment_date": slot_date,
            "appointment_time": slot_time,
            "service_requested": service_requested,
            "problem_description": problem_description,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = await requests_collection.insert_one(request_document)
        request_document["_id"] = result.inserted_id

        return {
            "message": "Service request submitted successfully.",
            "request": serialize_mongo_document(request_document),
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to submit service request.",
        )
