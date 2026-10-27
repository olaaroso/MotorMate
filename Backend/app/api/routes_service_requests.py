from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.database import db_instance
from app.models.appointment import (
    ServiceRequestCreate,
    ServiceRequestStatus,
    ServiceRequestStatusUpdate,
)
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

OTHER_SERVICE = "Other / Not sure"
RESERVED_STATUSES = {"accepted", "completed"}
_indexes_ready = False


def get_collection(name: str):
    if db_instance.db is None:
        raise HTTPException(status_code=503, detail="Database is not connected.")
    return db_instance.db[name]


def serialize_mongo_document(document: dict) -> dict:
    serialized = dict(document)
    serialized["id"] = str(serialized.pop("_id"))
    return serialized


def format_mechanic_address(mechanic: dict) -> str:
    street = str(mechanic.get("street_address") or "").strip()
    city = str(mechanic.get("city") or "").strip()
    state = str(mechanic.get("state") or "").strip().upper()
    zip_code = str(mechanic.get("zip_code") or "").strip()

    if street or city or state or zip_code:
        locality = " ".join(part for part in (state, zip_code) if part)
        city_line = ", ".join(part for part in (city, locality) if part)
        return ", ".join(part for part in (street, city_line) if part)

    return str(mechanic.get("address") or "").strip()


async def ensure_service_request_indexes():
    """
    Pending requests may share a time, but MongoDB must never allow two
    accepted requests for the same mechanic/date/start-time.
    """
    global _indexes_ready

    if _indexes_ready:
        return

    collection = get_collection("service_requests")

    await collection.create_index(
        [
            ("mechanic_id", 1),
            ("appointment_date", 1),
            ("appointment_start_time", 1),
        ],
        unique=True,
        partialFilterExpression={"status": "accepted"},
        name="unique_accepted_mechanic_appointment",
    )

    await collection.create_index(
        [
            ("mechanic_id", 1),
            ("status", 1),
            ("appointment_date", 1),
            ("appointment_start_time", 1),
        ],
        name="mechanic_request_list",
    )

    await collection.create_index(
        [
            ("customer_id", 1),
            ("created_at", -1),
        ],
        name="customer_request_list",
    )

    _indexes_ready = True


def normalize_services(services) -> set[str]:
    return {
        str(service).strip().casefold()
        for service in (services or [])
        if str(service).strip()
    }


def current_vehicle_mileage(vehicle: dict) -> Optional[int]:
    raw = vehicle.get("current_mileage")
    if raw is None or raw == "":
        return None

    try:
        mileage = int(raw)
    except (TypeError, ValueError):
        return None

    return mileage if mileage >= 0 else None


async def sync_completed_service_history(request_document: dict):
    """Create or refresh the Garage service-history record for a completed job."""
    request_id = str(request_document.get("_id") or "").strip()
    vehicle_id = str(request_document.get("vehicle_id") or "").strip()
    owner_id = str(request_document.get("customer_id") or "").strip()

    if not request_id or not owner_id or not ObjectId.is_valid(vehicle_id):
        return

    vehicle = await get_collection("vehicles").find_one(
        {
            "_id": ObjectId(vehicle_id),
            "owner_id": owner_id,
        }
    )
    if not vehicle:
        return

    mileage = request_document.get("completed_mileage")
    if mileage is None:
        mileage = current_vehicle_mileage(vehicle)
    if mileage is None:
        mileage = current_vehicle_mileage(request_document.get("vehicle_summary") or {})
    if mileage is None:
        mileage = 0

    notes = str(request_document.get("completion_notes") or "").strip() or None
    now_iso = datetime.now(timezone.utc).isoformat()

    await get_collection("service_history").update_one(
        {
            "source_service_request_id": request_id,
            "owner_id": owner_id,
        },
        {
            "$set": {
                "vehicle_id": vehicle_id,
                "owner_id": owner_id,
                "record_type": "maintenance",
                "title": request_document.get("service_requested") or "Completed service",
                "service_date": request_document.get("appointment_date"),
                "mileage": mileage,
                "cost": request_document.get("completed_cost"),
                "provider": request_document.get("shop_name"),
                "part_name": None,
                "notes": notes,
                "source": "mechanic_service_request",
                "source_service_request_id": request_id,
                "updated_at": now_iso,
            },
            "$setOnInsert": {
                "created_at": now_iso,
            },
        },
        upsert=True,
    )


@router.post("")
async def create_service_request(payload: ServiceRequestCreate):
    """
    Creates a pending request for a valid 30-minute appointment window.
    Pending requests do not reserve the time; accepted/completed requests do.
    """
    await ensure_service_request_indexes()

    customer_id = payload.customer_id.strip()
    customer_name = payload.customer_name.strip()
    mechanic_id = payload.mechanic_id.strip()
    service_requested = payload.service_requested.strip()
    problem_description = payload.problem_description.strip()

    if not customer_id:
        raise HTTPException(status_code=400, detail="customer_id is required.")
    if not customer_name:
        raise HTTPException(status_code=400, detail="customer_name is required.")
    if not mechanic_id:
        raise HTTPException(status_code=400, detail="mechanic_id is required.")
    if not service_requested:
        raise HTTPException(status_code=400, detail="Choose the service you need.")
    if not ObjectId.is_valid(payload.vehicle_id):
        raise HTTPException(status_code=400, detail="Invalid vehicle ID.")

    mechanics = get_collection("mechanics")
    vehicles = get_collection("vehicles")
    requests = get_collection("service_requests")

    try:
        mechanic = await mechanics.find_one({"owner_id": mechanic_id})
        if not mechanic:
            raise HTTPException(status_code=404, detail="Mechanic not found.")

        if mechanic_id == customer_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot request an appointment at your own shop.",
            )

        requested_service_key = service_requested.casefold()
        offered_services = normalize_services(mechanic.get("services_offered"))

        if (
            requested_service_key != OTHER_SERVICE.casefold()
            and requested_service_key not in offered_services
        ):
            raise HTTPException(
                status_code=400,
                detail="This mechanic no longer lists that service.",
            )

        operating_hours = mechanic.get("operating_hours") or {}
        if not any(parse_hours(value) for value in operating_hours.values()):
            raise HTTPException(
                status_code=400,
                detail="This shop is not accepting online appointments.",
            )

        appointment_date = payload.appointment_date
        start_time = payload.appointment_start_time
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
                detail=(
                    f"The shop is closed on "
                    f"{day_key_for(appointment_date).capitalize()}s."
                ),
            )

        window = next((item for item in windows if item["start"] == start_time), None)
        if not window:
            raise HTTPException(
                status_code=400,
                detail=(
                    "That time is not a valid 30-minute window within the "
                    f"shop's hours ({day_hours})."
                ),
            )

        if not remove_past_windows([window], appointment_date, now):
            raise HTTPException(
                status_code=409,
                detail="That appointment time has already passed.",
            )

        slot_filter = {
            "mechanic_id": mechanic_id,
            "appointment_date": appointment_date.isoformat(),
            "appointment_start_time": start_time,
        }

        if await requests.find_one(
            {**slot_filter, "status": {"$in": list(RESERVED_STATUSES)}}
        ):
            raise HTTPException(
                status_code=409,
                detail="That appointment time is no longer available.",
            )

        vehicle = await vehicles.find_one(
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

        if await requests.find_one(
            {
                **slot_filter,
                "customer_id": customer_id,
                "status": "pending",
            }
        ):
            raise HTTPException(
                status_code=409,
                detail="You already have a pending request for this appointment.",
            )

        request_document = {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "mechanic_id": mechanic_id,
            "shop_name": mechanic.get("shop_name", "MotorMate Mechanic"),
            "shop_address": format_mechanic_address(mechanic),
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

        result = await requests.insert_one(request_document)
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


@router.get("/mechanic/{mechanic_id}")
async def get_mechanic_service_requests(
    mechanic_id: str,
    status: Optional[ServiceRequestStatus] = Query(default=None),
):
    """Lists requests sent to a mechanic, optionally filtered by status."""
    mechanic_id = mechanic_id.strip()
    if not mechanic_id:
        raise HTTPException(status_code=400, detail="mechanic_id is required.")

    await ensure_service_request_indexes()
    requests = get_collection("service_requests")

    query = {"mechanic_id": mechanic_id, "hidden_for_mechanic": {"$ne": True}}
    if status:
        query["status"] = status

    try:
        cursor = requests.find(query).sort(
            [
                ("appointment_date", 1),
                ("appointment_start_time", 1),
                ("created_at", 1),
            ]
        )
        results = [serialize_mongo_document(item) async for item in cursor]
        return {"count": len(results), "results": results}
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve mechanic service requests.",
        )


@router.get("/customer/{customer_id}")
async def get_customer_service_requests(
    customer_id: str,
    status: Optional[ServiceRequestStatus] = Query(default=None),
):
    """Lists a car owner's service requests, optionally filtered by status."""
    customer_id = customer_id.strip()
    if not customer_id:
        raise HTTPException(status_code=400, detail="customer_id is required.")

    await ensure_service_request_indexes()
    requests = get_collection("service_requests")

    query = {"customer_id": customer_id, "hidden_for_customer": {"$ne": True}}
    if status:
        query["status"] = status

    try:
        cursor = requests.find(query).sort("created_at", -1)
        results = [serialize_mongo_document(item) async for item in cursor]
        return {"count": len(results), "results": results}
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve customer service requests.",
        )


@router.patch("/{request_id}/status")
async def update_service_request_status(
    request_id: str,
    payload: ServiceRequestStatusUpdate,
):
    """
    Advances a service request through its mechanic-controlled lifecycle:

    pending -> accepted | declined
    accepted -> completed

    When completing a request, completed_mileage is optional. If supplied,
    the owner's actual Garage vehicle mileage and this request's vehicle
    snapshot are updated together from the mechanic's final odometer reading.
    """
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid service request ID.")

    mechanic_id = payload.mechanic_id.strip()
    if not mechanic_id:
        raise HTTPException(status_code=400, detail="mechanic_id is required.")

    has_completion_details = any(
        value is not None
        for value in (
            payload.completed_mileage,
            payload.completed_cost,
            payload.completion_notes,
        )
    )
    if has_completion_details and payload.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Completion mileage, cost, and notes can only be supplied when completing a request.",
        )

    await ensure_service_request_indexes()
    requests = get_collection("service_requests")
    vehicles = get_collection("vehicles")
    request_object_id = ObjectId(request_id)

    request_document = await requests.find_one(
        {
            "_id": request_object_id,
            "mechanic_id": mechanic_id,
        }
    )
    if not request_document:
        raise HTTPException(
            status_code=404,
            detail="Service request not found for this mechanic.",
        )

    current_status = request_document.get("status", "pending")

    if current_status == payload.status:
        if current_status == "completed":
            await sync_completed_service_history(request_document)
        return {
            "message": f"Service request is already {payload.status}.",
            "request": serialize_mongo_document(request_document),
        }

    now_iso = datetime.now(timezone.utc).isoformat()

    if payload.status == "completed":
        if current_status != "accepted":
            raise HTTPException(
                status_code=409,
                detail="Only an accepted appointment can be marked completed.",
            )

        vehicle_id = str(request_document.get("vehicle_id") or "").strip()
        customer_id = str(request_document.get("customer_id") or "").strip()

        if not vehicle_id or not ObjectId.is_valid(vehicle_id):
            raise HTTPException(
                status_code=409,
                detail="The linked vehicle is unavailable for completion.",
            )

        vehicle = await vehicles.find_one(
            {
                "_id": ObjectId(vehicle_id),
                "owner_id": customer_id,
            }
        )
        if not vehicle:
            raise HTTPException(
                status_code=404,
                detail="The customer's vehicle could not be found.",
            )

        existing_mileage = current_vehicle_mileage(vehicle)
        if (
            payload.completed_mileage is not None
            and existing_mileage is not None
            and payload.completed_mileage < existing_mileage
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Completed mileage cannot be lower than the vehicle's "
                    f"current mileage ({existing_mileage:,})."
                ),
            )

        completion_update = {
            "status": "completed",
            "completed_at": now_iso,
        }

        if payload.completed_mileage is not None:
            await vehicles.update_one(
                {
                    "_id": ObjectId(vehicle_id),
                    "owner_id": customer_id,
                },
                {"$set": {"current_mileage": payload.completed_mileage}},
            )
            completion_update["completed_mileage"] = payload.completed_mileage
            completion_update["vehicle_summary.current_mileage"] = payload.completed_mileage

        if payload.completed_cost is not None:
            completion_update["completed_cost"] = round(payload.completed_cost, 2)

        completion_notes = str(payload.completion_notes or "").strip()
        if completion_notes:
            completion_update["completion_notes"] = completion_notes

        updated = await requests.find_one_and_update(
            {
                "_id": request_object_id,
                "mechanic_id": mechanic_id,
                "status": "accepted",
            },
            {"$set": completion_update},
            return_document=ReturnDocument.AFTER,
        )

        if not updated:
            raise HTTPException(
                status_code=409,
                detail="Request is no longer an accepted appointment.",
            )

        await sync_completed_service_history(updated)

        return {
            "message": "Service request marked completed and added to Garage service history.",
            "request": serialize_mongo_document(updated),
        }

    if current_status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"This request is already {current_status}.",
        )

    if payload.status == "declined":
        updated = await requests.find_one_and_update(
            {
                "_id": request_object_id,
                "mechanic_id": mechanic_id,
                "status": "pending",
            },
            {
                "$set": {
                    "status": "declined",
                    "responded_at": now_iso,
                }
            },
            return_document=ReturnDocument.AFTER,
        )

        if not updated:
            raise HTTPException(status_code=409, detail="Request is no longer pending.")

        return {
            "message": "Service request declined.",
            "request": serialize_mongo_document(updated),
        }

    slot_filter = {
        "mechanic_id": mechanic_id,
        "appointment_date": request_document["appointment_date"],
        "appointment_start_time": request_document["appointment_start_time"],
    }

    if await requests.find_one(
        {
            **slot_filter,
            "_id": {"$ne": request_object_id},
            "status": {"$in": list(RESERVED_STATUSES)},
        }
    ):
        raise HTTPException(
            status_code=409,
            detail="Another request has already reserved this time.",
        )

    try:
        updated = await requests.find_one_and_update(
            {
                "_id": request_object_id,
                "mechanic_id": mechanic_id,
                "status": "pending",
            },
            {
                "$set": {
                    "status": "accepted",
                    "responded_at": now_iso,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Another request has already been accepted for this time.",
        )

    if not updated:
        raise HTTPException(status_code=409, detail="Request is no longer pending.")

    await requests.update_many(
        {
            **slot_filter,
            "_id": {"$ne": request_object_id},
            "status": "pending",
        },
        {
            "$set": {
                "status": "declined",
                "responded_at": now_iso,
                "status_reason": (
                    "Another request was accepted for this appointment time."
                ),
            }
        },
    )

    return {
        "message": "Service request accepted.",
        "request": serialize_mongo_document(updated),
    }


@router.delete("/{request_id}")
async def remove_completed_service_request(
    request_id: str,
    actor_id: str = Query(..., min_length=1),
    view: Literal["mechanic", "customer"] = Query(...),
):
    """Hide a completed request from one side's appointment list without deleting Garage history."""
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid service request ID.")

    actor_id = actor_id.strip()
    if not actor_id:
        raise HTTPException(status_code=400, detail="actor_id is required.")

    requests = get_collection("service_requests")
    request_object_id = ObjectId(request_id)
    actor_field = "mechanic_id" if view == "mechanic" else "customer_id"
    hidden_field = "hidden_for_mechanic" if view == "mechanic" else "hidden_for_customer"

    request_document = await requests.find_one(
        {
            "_id": request_object_id,
            actor_field: actor_id,
        }
    )
    if not request_document:
        raise HTTPException(status_code=404, detail="Service request not found.")

    if request_document.get("status") != "completed":
        raise HTTPException(
            status_code=409,
            detail="Only completed service requests can be removed from the list.",
        )

    await requests.update_one(
        {"_id": request_object_id},
        {
            "$set": {
                hidden_field: True,
                f"{hidden_field}_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {
        "message": "Completed service removed from this appointment list.",
    }
