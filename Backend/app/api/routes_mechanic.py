import re
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import require_role
from app.core.database import db_instance
from app.models.user import MechanicProfile
from app.services.location_service import LocationProviderError, location_service
from app.services.scheduling import remove_past_windows, windows_for_date

router = APIRouter(prefix="/api/mechanics", tags=["Mechanic Matching"])


def get_mechanics_collection():
    if db_instance.db is None:
        raise HTTPException(status_code=503, detail="Database is not connected.")
    return db_instance.db["mechanics"]


def get_service_requests_collection():
    if db_instance.db is None:
        raise HTTPException(status_code=503, detail="Database is not connected.")
    return db_instance.db["service_requests"]


def format_mechanic_address(document: dict) -> str:
    """Build a display/geocoding address from structured fields, with legacy fallback."""
    street = str(document.get("street_address") or "").strip()
    city = str(document.get("city") or "").strip()
    state = str(document.get("state") or "").strip().upper()
    zip_code = str(document.get("zip_code") or "").strip()

    if street or city or state or zip_code:
        locality = " ".join(part for part in (state, zip_code) if part)
        city_line = ", ".join(part for part in (city, locality) if part)
        return ", ".join(part for part in (street, city_line) if part)

    return str(document.get("address") or "").strip()


def serialize_mongo_document(document: dict) -> dict:
    serialized = dict(document)
    serialized["id"] = str(serialized.pop("_id"))
    serialized.pop("rating", None)
    serialized["address"] = format_mechanic_address(serialized)
    return serialized


def validate_zip_code(zip_code: Optional[str]) -> Optional[str]:
    if zip_code is None or not zip_code.strip():
        return None

    normalized = zip_code.strip()
    if not re.fullmatch(r"\d{5}", normalized):
        raise HTTPException(status_code=400, detail="ZIP code must contain exactly 5 digits.")
    return normalized


def service_filter(service: str) -> dict:
    return {
        "$regex": f"^{re.escape(service.strip())}$",
        "$options": "i",
    }


@router.post("/register")
async def register_mechanic(mechanic: MechanicProfile):
    """Create or update a mechanic shop profile keyed by Firebase owner UID."""
    owner_id = mechanic.owner_id.strip()
    shop_name = mechanic.shop_name.strip()

    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")
    if not shop_name:
        raise HTTPException(status_code=400, detail="Shop name is required.")

    structured_location = [
        mechanic.street_address,
        mechanic.city,
        mechanic.state,
        mechanic.zip_code,
    ]
    has_any_structured_location = any(value and value.strip() for value in structured_location)
    has_complete_structured_location = all(value and value.strip() for value in structured_location)

    if has_any_structured_location and not has_complete_structured_location:
        raise HTTPException(
            status_code=400,
            detail="Street address, city, state, and ZIP code are all required.",
        )

    if not has_complete_structured_location and not (mechanic.address and mechanic.address.strip()):
        raise HTTPException(status_code=400, detail="Shop location is required.")

    mechanic_dict = mechanic.model_dump(exclude_none=True)
    mechanic_dict["owner_id"] = owner_id
    mechanic_dict["shop_name"] = shop_name
    mechanic_dict["services_offered"] = [
        service.strip()
        for service in mechanic.services_offered
        if service and service.strip()
    ]

    if has_complete_structured_location:
        mechanic_dict["street_address"] = mechanic.street_address.strip()
        mechanic_dict["city"] = mechanic.city.strip()
        mechanic_dict["state"] = mechanic.state.strip().upper()
        mechanic_dict["zip_code"] = mechanic.zip_code.strip()
        mechanic_dict.pop("address", None)

    display_address = format_mechanic_address(mechanic_dict)

    try:
        mechanics_collection = get_mechanics_collection()
        await mechanics_collection.create_index([("location", "2dsphere")])

        location = None
        if display_address:
            try:
                location = await location_service.geocode_address(display_address)
            except LocationProviderError:
                # Profile saving should still work if the external geocoder is unavailable.
                location = None

        update: dict = {"$set": mechanic_dict}
        unset_fields: dict[str, str] = {"rating": ""}

        if location:
            update["$set"]["location"] = {
                "type": "Point",
                "coordinates": [location["longitude"], location["latitude"]],
            }
        else:
            unset_fields["location"] = ""

        if has_complete_structured_location:
            # Structured location is authoritative; address is derived for responses.
            unset_fields["address"] = ""

        if unset_fields:
            update["$unset"] = unset_fields

        await mechanics_collection.update_one(
            {"owner_id": owner_id},
            update,
            upsert=True,
        )

        saved_profile = await mechanics_collection.find_one({"owner_id": owner_id})
        serialized_profile = serialize_mongo_document(saved_profile) if saved_profile else None

        return {
            "message": "Mechanic profile saved successfully",
            "mechanic_id": serialized_profile["id"] if serialized_profile else None,
            "profile": serialized_profile,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to save mechanic profile in the database.",
        )


@router.get("")
async def browse_mechanics(
    zip_code: Optional[str] = None,
    service: Optional[str] = None,
    exclude_owner_id: Optional[str] = None,
):
    """Public mechanic discovery for the car-owner Find Mechanics page."""
    mechanics_collection = get_mechanics_collection()
    normalized_zip = validate_zip_code(zip_code)

    filter_query: dict = {"owner_id": {"$exists": True, "$nin": [None, ""]}}

    if exclude_owner_id and exclude_owner_id.strip():
        filter_query["owner_id"]["$nin"].append(exclude_owner_id.strip())

    if normalized_zip:
        filter_query["$or"] = [
            {"zip_code": normalized_zip},
            {"address": {"$regex": rf"\b{re.escape(normalized_zip)}\b"}},
        ]

    if service and service.strip():
        filter_query["services_offered"] = service_filter(service)

    try:
        cursor = mechanics_collection.find(filter_query).sort("shop_name", 1).limit(50)
        mechanics = [serialize_mongo_document(doc) async for doc in cursor]
        return {"count": len(mechanics), "results": mechanics}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve mechanics.")


@router.get("/services")
async def list_available_services():
    """Return the distinct services currently offered by registered mechanics."""
    try:
        services = await get_mechanics_collection().distinct(
            "services_offered",
            {"owner_id": {"$exists": True, "$nin": [None, ""]}},
        )
        cleaned = sorted(
            {str(service).strip() for service in services if str(service).strip()},
            key=str.casefold,
        )
        return {"count": len(cleaned), "services": cleaned}
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve mechanic services.")


@router.get("/search")
async def search_mechanics(
    zip_code: str = Query(..., description="User's 5-digit zip code"),
    service_needed: str = Query(..., description="The part or service predicted by the ML model"),
    _: dict = Depends(require_role("mechanic", "consumer")),
):
    """Find mechanics in a ZIP code offering a requested service."""
    normalized_zip = validate_zip_code(zip_code)

    try:
        cursor = get_mechanics_collection().find(
            {
                "$or": [
                    {"zip_code": normalized_zip},
                    {"address": {"$regex": rf"\b{re.escape(normalized_zip)}\b"}},
                ],
                "services_offered": service_filter(service_needed),
            }
        )
        mechanics = await cursor.to_list(length=10)

        if not mechanics:
            return {
                "message": "No mechanics found for this service in your area.",
                "results": [],
            }

        formatted_results = []
        for mechanic in mechanics:
            labor_hours = 2.0
            estimated_labor_cost = (mechanic.get("price_per_hour") or 0) * labor_hours
            formatted_results.append(
                {
                    "mechanic_id": str(mechanic["_id"]),
                    "owner_id": mechanic.get("owner_id"),
                    "shop_name": mechanic.get("shop_name"),
                    "address": format_mechanic_address(mechanic),
                    "estimated_labor_cost": estimated_labor_cost,
                    "services": mechanic.get("services_offered"),
                }
            )

        return {"results": formatted_results}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to execute mechanic search.")


@router.get("/{owner_id}/appointment-windows")
async def get_appointment_windows(
    owner_id: str,
    appointment_date: date = Query(..., alias="date", description="Appointment date, YYYY-MM-DD"),
):
    """
    Generate 30-minute windows from operating hours.

    Pending requests do not reserve a time. Accepted or completed requests keep
    that appointment time unavailable.
    """
    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")
    if appointment_date < date.today():
        raise HTTPException(status_code=400, detail="Appointment date cannot be in the past.")

    try:
        profile = await get_mechanics_collection().find_one({"owner_id": owner_id})
        if not profile:
            raise HTTPException(status_code=404, detail="Mechanic profile not found.")

        day_hours, windows = windows_for_date(profile.get("operating_hours"), appointment_date)
        available_windows = remove_past_windows(windows, appointment_date)

        if available_windows:
            accepted_cursor = get_service_requests_collection().find(
                {
                    "mechanic_id": owner_id,
                    "appointment_date": appointment_date.isoformat(),
                    "status": {"$in": ["accepted", "completed"]},
                },
                {"appointment_start_time": 1},
            )
            reserved_start_times = {
                item.get("appointment_start_time")
                async for item in accepted_cursor
                if item.get("appointment_start_time")
            }
            available_windows = [
                window
                for window in available_windows
                if window["start"] not in reserved_start_times
            ]

        return {
            "date": appointment_date.isoformat(),
            "open": day_hours is not None,
            "hours": day_hours,
            "windows": available_windows,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve appointment windows.")


# Keep this dynamic route after static routes such as /services and /search.
@router.get("/{owner_id}")
async def get_mechanic_profile(owner_id: str):
    """Fetch a mechanic shop profile by Firebase owner_id."""
    owner_id = owner_id.strip()
    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")

    try:
        profile = await get_mechanics_collection().find_one({"owner_id": owner_id})
        if not profile:
            raise HTTPException(status_code=404, detail="Mechanic profile not found.")
        return {"profile": serialize_mongo_document(profile)}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve mechanic profile.")
