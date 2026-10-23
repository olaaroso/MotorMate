import re
from datetime import date, datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import require_role
from app.core.database import db_instance
from app.models.appointment import AppointmentSlotCreate
from app.models.user import MechanicProfile

router = APIRouter(prefix="/api/mechanics", tags=["Mechanic Matching"])


def get_mechanics_collection():
    if db_instance.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected.",
        )

    return db_instance.db["mechanics"]


def get_availability_collection():
    """
    Appointment slots live in their own collection (one document per
    slot) rather than embedded on the mechanic profile, because
    /register does a full `$set` of the profile and would otherwise
    clobber slots on every shop-profile save.
    """
    if db_instance.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected.",
        )

    return db_instance.db["mechanic_availability_slots"]


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
    page. Each profile includes its upcoming slots with status "available".
    Uses exactly two queries: one for profiles, one for all their slots.
    """
    mechanics_collection = get_mechanics_collection()
    availability_collection = get_availability_collection()

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

        slots_by_owner: dict = {m["owner_id"]: [] for m in mechanics}

        if slots_by_owner:
            slots_cursor = availability_collection.find(
                {
                    "owner_id": {"$in": list(slots_by_owner.keys())},
                    "status": "available",
                    "date": {"$gte": date.today().isoformat()},
                }
            ).sort([("date", 1), ("time", 1)])

            async for slot in slots_cursor:
                slots_by_owner[slot["owner_id"]].append(
                    {
                        "id": str(slot["_id"]),
                        "date": slot.get("date"),
                        "time": slot.get("time"),
                        "status": slot.get("status"),
                    }
                )

        for mechanic in mechanics:
            mechanic["available_slots"] = slots_by_owner.get(mechanic["owner_id"], [])

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
# APPOINTMENT AVAILABILITY SLOTS
# =========================================================
#
# Slot status is strictly the slot's own availability state
# ("available" now; "booked" later once a service request is
# accepted). Pending/accepted/declined belong to the future
# service-request document, not to the slot.


@router.get("/{owner_id}/availability")
async def get_availability_slots(owner_id: str):
    """
    Lists a mechanic's appointment slots sorted by date, then time.
    Returns an empty list (not 404) when the mechanic has no slots yet.
    """
    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")

    availability_collection = get_availability_collection()

    try:
        cursor = availability_collection.find({"owner_id": owner_id}).sort(
            [("date", 1), ("time", 1)]
        )

        results = []
        async for slot in cursor:
            results.append(serialize_mongo_document(slot))

        return {"count": len(results), "results": results}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve appointment availability.",
        )


@router.post("/{owner_id}/availability")
async def add_availability_slot(owner_id: str, payload: AppointmentSlotCreate):
    """
    Adds a single appointment slot for a mechanic. Rejects past dates and
    exact duplicates (same owner, date and time) with 409.
    """
    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")

    if payload.date < date.today():
        raise HTTPException(
            status_code=400,
            detail="Appointment slots cannot be in the past.",
        )

    availability_collection = get_availability_collection()

    slot_date = payload.date.isoformat()
    slot_time = payload.time

    try:
        existing_slot = await availability_collection.find_one(
            {
                "owner_id": owner_id,
                "date": slot_date,
                "time": slot_time,
            }
        )

        if existing_slot:
            raise HTTPException(
                status_code=409,
                detail="You already have an appointment slot at that date and time.",
            )

        slot_document = {
            "owner_id": owner_id,
            "date": slot_date,
            "time": slot_time,
            "status": "available",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        result = await availability_collection.insert_one(slot_document)
        slot_document["_id"] = result.inserted_id

        return {
            "message": "Appointment slot added successfully.",
            "slot": serialize_mongo_document(slot_document),
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to add appointment slot.",
        )


@router.delete("/{owner_id}/availability/{slot_id}")
async def delete_availability_slot(owner_id: str, slot_id: str):
    """
    Removes one of the mechanic's appointment slots. The delete filter
    includes owner_id so a mechanic can only remove their own slots.
    """
    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(status_code=400, detail="owner_id is required.")

    if not ObjectId.is_valid(slot_id):
        raise HTTPException(status_code=400, detail="Invalid slot ID.")

    availability_collection = get_availability_collection()

    try:
        result = await availability_collection.delete_one(
            {
                "_id": ObjectId(slot_id),
                "owner_id": owner_id,
            }
        )

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Appointment slot not found or you do not own it.",
            )

        return {
            "message": "Appointment slot removed successfully.",
            "slot_id": slot_id,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to remove appointment slot.",
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