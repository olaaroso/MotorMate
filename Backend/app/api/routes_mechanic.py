from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import require_role
from app.core.database import db_instance
from app.models.user import MechanicProfile

router = APIRouter(prefix="/api/mechanics", tags=["Mechanic Matching"])


def get_mechanics_collection():
    if db_instance.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected.",
        )

    return db_instance.db["mechanics"]


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