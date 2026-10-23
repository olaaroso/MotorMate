from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from app.core.database import db_instance
from app.models.appointment import ServiceRequestCreate
from app.services.scheduling import (
    day_key_for,
    parse_hours,
    remove_past_windows,
    windows_for_date,
)

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
    Creates a pending request for a 30-minute appointment window.

    The window must be one generated from the mechanic's operating hours
    for that weekday; the end time, shop details and vehicle summary come
    from the database. Pending requests do not block the window for
    other customers.
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

    mechanic_id = payload.mechanic_id.strip()

    if not mechanic_id:
        raise HTTPException(status_code=400, detail="mechanic_id is required.")

    if not ObjectId.is_valid(payload.vehicle_id):
        raise HTTPException(status_code=400, detail="Invalid vehicle ID.")

    appointment_date = payload.appointment_date
    start_time = payload.appointment_start_time

    mechanics_collection = get_collection("mechanics")
    vehicles_collection = get_collection("vehicles")
    requests_collection = get_collection("service_requests")

    try:
        mechanic = await mechanics_collection.find_one({"owner_id": mechanic_id})

        if not mechanic:
            raise HTTPException(status_code=404, detail="Mechanic not found.")

        if mechanic_id == customer_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot request an appointment at your own shop.",
            )

        operating_hours = mechanic.get("operating_hours") or {}

        if not any(parse_hours(value) for value in operating_hours.values()):
            raise HTTPException(
                status_code=400,
                detail="This shop has not set operating hours, so online appointments are unavailable.",
            )

        # Server-local time; fine for local dev, but a deployed server
        # would need the shop's time zone for same-day comparisons.
        now = datetime.now()

        if appointment_date < now.date():
            raise HTTPException(
                status_code=400,
                detail="Appointment date cannot be in the past.",
            )

        day_hours, windows = windows_for_date(operating_hours, appointment_date)

        if day_hours is None:
            raise HTTPException(
                status_code=400,
                detail=f"The shop is closed on {day_key_for(appointment_date).capitalize()}s.",
            )

        window = next((w for w in windows if w["start"] == start_time), None)

        if not window:
            raise HTTPException(
                status_code=400,
                detail=f"That time is not a valid 30-minute window within the shop's hours ({day_hours}).",
            )

        if not remove_past_windows([window], appointment_date, now):
            raise HTTPException(
                status_code=409,
                detail="That appointment time has already passed.",
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

        # One pending request per customer per shop/date/start time,
        # regardless of vehicle. Other customers' pending requests
        # do not block this window.
        existing_request = await requests_collection.find_one(
            {
                "customer_id": customer_id,
                "mechanic_id": mechanic_id,
                "appointment_date": appointment_date.isoformat(),
                "appointment_start_time": start_time,
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
            "appointment_date": appointment_date.isoformat(),
            "appointment_start_time": window["start"],
            "appointment_end_time": window["end"],
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
