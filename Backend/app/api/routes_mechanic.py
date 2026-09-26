from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import require_role
from app.core.database import db_instance
from app.models.user import MechanicProfile

router = APIRouter(prefix="/api/mechanics", tags=["Mechanic Matching"])


@router.post("/register")
async def register_mechanic(mechanic: MechanicProfile, _: dict = Depends(require_role("mechanic"))):
    """
    Registers a new mechanic profile in the database.
    """
    # Convert Pydantic model to a standard dictionary for MongoDB
    mechanic_dict = mechanic.model_dump()
    
    try:
        result = await db_instance.db["mechanics"].insert_one(mechanic_dict)
        return {
            "message": "Mechanic registered successfully",
            "mechanic_id": str(result.inserted_id),
            "shop_name": mechanic.shop_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to register mechanic in the database.")

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