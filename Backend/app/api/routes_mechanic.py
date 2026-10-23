import re
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import require_role
from app.core.database import db_instance
from app.models.user import MechanicProfile
from app.services.scheduling import remove_past_windows, windows_for_date

router = APIRouter(prefix="/api/mechanics", tags=["Mechanic Matching"])


def get_mechanics_collection():
    if db_instance.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected.",
        )

    return db_instance.db["mechanics"]


def serialize_mongo_document(document: dict):
    document["id"] = str(document["_id"])
    document.pop("_id", None)
    return document


@router.post("/register")
async def register_mechanic(mechanic: MechanicProfile):
    """
    Creates or updates (upsert) the mechanic's shop profile, keyed by
    owner_id (the Firebase Auth UID). Safe to call both the first time
    a mechanic sets up their shop and on every later edit.
    """
    owner_id = mechanic.owner_id.strip()

    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")

    mechanic_dict = mechanic.model_dump()

    try:
        mechanics_collection = get_mechanics_collection()

        await mechanics_collection.update_one(
            {"owner_id": owner_id},
            {"$set": mechanic_dict},
            upsert=True,
        )

        saved_profile = await mechanics_collection.find_one({"owner_id": owner_id})
        if saved_profile:
            saved_profile["_id"] = str(saved_profile["_id"])

        return {
            "message": "Mechanic profile saved successfully",
            "mechanic_id": saved_profile["_id"] if saved_profile else None,
            "profile": saved_profile,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save mechanic profile in the database.")


@router.get("")
async def browse_mechanics(
    zip_code: Optional[str] = None,
    service: Optional[str] = None,
    exclude_owner_id: Optional[str] = None,
):
    """
    Public, read-only mechanic discovery for the car-owner Find Mechanics
    page. Appointment availability comes from each profile's operating_hours.
    """
    mechanics_collection = get_mechanics_collection()

    filter_query: dict = {"owner_id": {"$exists": True, "$nin": [None, ""]}}

    if exclude_owner_id and exclude_owner_id.strip():
        filter_query["owner_id"]["$nin"].append(exclude_owner_id.strip())

    if zip_code and zip_code.strip():
        filter_query["address"] = {"$regex": re.escape(zip_code.strip())}

    if service and service.strip():
        filter_query["services_offered"] = {
            "$regex": re.escape(service.strip()),
            "$options": "i",
        }

    try:
        cursor = mechanics_collection.find(filter_query).sort("shop_name", 1).limit(50)
        mechanics = [serialize_mongo_document(doc) async for doc in cursor]

        return {"count": len(mechanics), "results": mechanics}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve mechanics.")


@router.get("/search")
async def search_mechanics(
    zip_code: str = Query(..., description="User's 5-digit zip code"),
    service_needed: str = Query(..., description="The part or service predicted by the ML model"),
    _: dict = Depends(require_role("mechanic", "consumer")),
):
    """
    Finds mechanics in a specific zip code offering the predicted repair service.
    """
    try:
        # Query MongoDB for mechanics matching the zip code and service array
        cursor = db_instance.db["mechanics"].find({
            "address": {"$regex": zip_code},
            "services_offered": service_needed
        })
        
        mechanics = await cursor.to_list(length=10)
        
        if not mechanics:
            return {"message": "No mechanics found for this service in your area.", "results": []}
            
        formatted_results = []
        for mech in mechanics:
            # Estimate labor cost based on hourly rate (assuming 2 hours of baseline labor)
            labor_hours = 2.0
            estimated_labor_cost = mech.get("price_per_hour", 0) * labor_hours
            
            formatted_results.append({
                "mechanic_id": str(mech["_id"]),
                "shop_name": mech.get("shop_name"),
                "address": mech.get("address"),
                "estimated_labor_cost": estimated_labor_cost,
                "services": mech.get("services_offered")
            })
            
        return {"results": formatted_results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to execute mechanic search.")


# =========================================================
# APPOINTMENT WINDOWS (generated from operating_hours)
# =========================================================


@router.get("/{owner_id}/appointment-windows")
async def get_appointment_windows(
    owner_id: str,
    appointment_date: date = Query(
        ..., alias="date", description="Appointment date, YYYY-MM-DD"
    ),
):
    """
    Returns the 30-minute appointment windows for one date, generated from
    the shop's operating hours for that weekday. Windows that have already
    started are omitted. Pending requests do not remove windows.
    """
    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")

    if appointment_date < date.today():
        raise HTTPException(
            status_code=400,
            detail="Appointment date cannot be in the past.",
        )

    try:
        profile = await get_mechanics_collection().find_one({"owner_id": owner_id})

        if not profile:
            raise HTTPException(status_code=404, detail="Mechanic profile not found.")

        day_hours, windows = windows_for_date(
            profile.get("operating_hours"), appointment_date
        )

        return {
            "date": appointment_date.isoformat(),
            "open": day_hours is not None,
            "hours": day_hours,
            "windows": remove_past_windows(windows, appointment_date),
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve appointment windows.",
        )


# NOTE: this dynamic route must stay declared after "/search" above, since
# FastAPI matches routes in declaration order and "/{owner_id}" would
# otherwise shadow the static "/search" path.
@router.get("/{owner_id}")
async def get_mechanic_profile(owner_id: str):
    """
    Fetches a mechanic's own shop profile by owner_id (Firebase Auth UID).
    Returns 404 if the mechanic has not created a profile yet.
    """
    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")

    try:
        mechanics_collection = get_mechanics_collection()

        profile = await mechanics_collection.find_one({"owner_id": owner_id})

        if not profile:
            raise HTTPException(status_code=404, detail="Mechanic profile not found.")

        profile["_id"] = str(profile["_id"])

        return {"profile": profile}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to retrieve mechanic profile.")