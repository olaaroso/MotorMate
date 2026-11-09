from datetime import date, datetime, timezone
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
from app.services.notifications import create_notification
from app.services.scheduling import (
    appointment_range,
    day_key_for,
    parse_hours,
    ranges_overlap,
    remove_past_windows,
    windows_for_date,
)
from app.services.service_estimates import (
    find_service_estimate,
    service_duration_minutes,
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


MECHANIC_REQUESTS_PAGE = "/mechanic/requests"
CUSTOMER_APPOINTMENTS_PAGE = "/appointments"


def describe_vehicle(request_document: dict) -> str:
    summary = request_document.get("vehicle_summary") or {}
    name = " ".join(
        str(part).strip()
        for part in (summary.get("year"), summary.get("make"), summary.get("model"))
        if part and str(part).strip()
    )
    return name or "vehicle"


def describe_appointment(request_document: dict) -> str:
    """Human-readable appointment time, e.g. 'Mon, Nov 9 at 9:00 AM'."""
    date_text = str(request_document.get("appointment_date") or "")
    time_text = str(request_document.get("appointment_start_time") or "")

    try:
        when = datetime.strptime(f"{date_text} {time_text}", "%Y-%m-%d %H:%M")
    except ValueError:
        return " ".join(part for part in (date_text, time_text) if part)

    hour = when.hour % 12 or 12
    period = "AM" if when.hour < 12 else "PM"
    return f"{when:%a, %b} {when.day} at {hour}:{when:%M} {period}"


async def notify_customer_of_status(request_document: dict):
    """Tell the car owner their request was accepted, declined, or completed."""
    status = request_document.get("status")
    service = request_document.get("service_requested") or "service"
    shop = request_document.get("shop_name") or "The shop"
    when = describe_appointment(request_document)

    if status == "accepted":
        title = "Service Request Accepted"
        message = f"{shop} accepted your {service} appointment on {when}."
    elif status == "declined":
        title = "Service Request Declined"
        reason = str(request_document.get("status_reason") or "").strip()
        message = f"{shop} declined your {service} request for {when}."
        if reason:
            message = f"{message} {reason}"
    elif status == "completed":
        title = "Service Completed"
        message = (
            f"{shop} completed your {service} on your {describe_vehicle(request_document)}. "
            "It has been added to your Garage service history."
        )
    else:
        return

    await create_notification(
        request_document.get("customer_id"),
        title,
        message,
        destination=CUSTOMER_APPOINTMENTS_PAGE,
    )


def format_clock(minutes: int) -> str:
    hour, minute = divmod(minutes, 60)
    period = "AM" if hour < 12 else "PM"
    return f"{hour % 12 or 12}:{minute:02d} {period}"


def appointment_outside_hours(
    operating_hours: Optional[dict],
    appointment_date: str,
    time_range: tuple[int, int],
) -> Optional[str]:
    """
    Explains why a saved appointment no longer fits the shop's current hours
    for its day, or returns None when it still fits.
    """
    try:
        day = day_key_for(date.fromisoformat(appointment_date)).capitalize()
    except ValueError:
        return "This request has an invalid appointment date."

    appointment_text = f"{format_clock(time_range[0])} – {format_clock(time_range[1])}"
    day_hours = (operating_hours or {}).get(day.lower())
    parsed = parse_hours(day_hours)

    if not parsed:
        return (
            f"This appointment ({appointment_text}) is on a {day}, and your shop "
            f"is now closed on {day}s. Update your hours or decline the request."
        )

    open_minutes, close_minutes = parsed
    if time_range[0] < open_minutes or time_range[1] > close_minutes:
        return (
            f"This appointment ({appointment_text}) no longer fits within your "
            f"current {day} hours ({day_hours}). Update your hours or decline "
            "the request."
        )

    return None


async def find_overlapping_requests(
    requests,
    mechanic_id: str,
    appointment_date: str,
    time_range: tuple[int, int],
    statuses: list[str],
    exclude_id: Optional[ObjectId] = None,
) -> list[dict]:
    """Requests for this mechanic/date whose occupied time overlaps time_range."""
    query = {
        "mechanic_id": mechanic_id,
        "appointment_date": appointment_date,
        "status": {"$in": statuses},
    }
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}

    overlapping = []
    async for item in requests.find(query):
        item_range = appointment_range(item)
        if item_range is not None and ranges_overlap(item_range, time_range):
            overlapping.append(item)
    return overlapping


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

        service_estimate = find_service_estimate(mechanic, service_requested)
        duration_minutes = service_duration_minutes(service_estimate)

        day_hours, windows = windows_for_date(
            operating_hours, appointment_date, duration_minutes
        )
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
            _, start_times = windows_for_date(operating_hours, appointment_date)
            if any(item["start"] == start_time for item in start_times):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"This service takes about {duration_minutes} minutes and "
                        f"must finish before the shop closes ({day_hours}). "
                        "Choose an earlier time."
                    ),
                )
            raise HTTPException(
                status_code=400,
                detail=(
                    "That time is not a valid 30-minute start time within the "
                    f"shop's hours ({day_hours})."
                ),
            )

        if not remove_past_windows([window], appointment_date, now):
            raise HTTPException(
                status_code=409,
                detail="That appointment time has already passed.",
            )

        requested_range = appointment_range(
            {
                "appointment_start_time": window["start"],
                "appointment_end_time": window["end"],
            }
        )
        if await find_overlapping_requests(
            requests,
            mechanic_id,
            appointment_date.isoformat(),
            requested_range,
            list(RESERVED_STATUSES),
        ):
            raise HTTPException(
                status_code=409,
                detail="That appointment time is no longer available.",
            )

        slot_filter = {
            "mechanic_id": mechanic_id,
            "appointment_date": appointment_date.isoformat(),
            "appointment_start_time": start_time,
        }

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
            "appointment_duration_minutes": duration_minutes,
            "service_estimate": {
                "estimated_price": (service_estimate or {}).get("estimated_price"),
                "estimated_duration_minutes": (service_estimate or {}).get(
                    "estimated_duration_minutes"
                ),
            },
            "service_requested": service_requested,
            "problem_description": problem_description,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = await requests.insert_one(request_document)
        request_document["_id"] = result.inserted_id

        await create_notification(
            mechanic_id,
            "New Service Request",
            (
                f"{customer_name} requested {service_requested} for their "
                f"{describe_vehicle(request_document)} on "
                f"{describe_appointment(request_document)}."
            ),
            destination=MECHANIC_REQUESTS_PAGE,
        )

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
        await notify_customer_of_status(updated)

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

        await notify_customer_of_status(updated)

        return {
            "message": "Service request declined.",
            "request": serialize_mongo_document(updated),
        }

    # The occupied time comes from the start/end stored on the request when
    # it was submitted, so later estimate changes don't move appointments.
    accepted_range = appointment_range(request_document)
    if accepted_range is None:
        raise HTTPException(
            status_code=409,
            detail="This request has an invalid appointment time.",
        )

    appointment_date = request_document["appointment_date"]

    mechanic = await get_collection("mechanics").find_one({"owner_id": mechanic_id})
    hours_problem = appointment_outside_hours(
        (mechanic or {}).get("operating_hours"),
        appointment_date,
        accepted_range,
    )
    if hours_problem:
        raise HTTPException(status_code=409, detail=hours_problem)

    async def overlapping_reservations():
        return await find_overlapping_requests(
            requests,
            mechanic_id,
            appointment_date,
            accepted_range,
            list(RESERVED_STATUSES),
            exclude_id=request_object_id,
        )

    if await overlapping_reservations():
        raise HTTPException(
            status_code=409,
            detail="Another accepted appointment already overlaps this time.",
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

    # Overlapping appointments can have different start times, so the unique
    # index can't catch them. Re-check after writing: if two overlapping
    # accepts race, at least one sees the other and backs out.
    if await overlapping_reservations():
        await requests.update_one(
            {"_id": request_object_id, "status": "accepted"},
            {"$set": {"status": "pending"}, "$unset": {"responded_at": ""}},
        )
        raise HTTPException(
            status_code=409,
            detail="Another accepted appointment already overlaps this time.",
        )

    await notify_customer_of_status(updated)

    # Decline overlapping pending requests one at a time so only requests
    # this call actually declined get a notification.
    competing = await find_overlapping_requests(
        requests,
        mechanic_id,
        appointment_date,
        accepted_range,
        ["pending"],
        exclude_id=request_object_id,
    )

    for competing_request in competing:
        auto_declined = await requests.find_one_and_update(
            {"_id": competing_request["_id"], "status": "pending"},
            {
                "$set": {
                    "status": "declined",
                    "responded_at": now_iso,
                    "status_reason": (
                        "Another appointment was accepted for an overlapping time."
                    ),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if auto_declined:
            await notify_customer_of_status(auto_declined)

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
