from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import require_role
from app.core.database import db_instance
from app.services.location_service import LocationProviderError, location_service

router = APIRouter(prefix="/api/location", tags=["Location"])


@router.get("/nearest-mechanics")
async def nearest_mechanics(
    address: str = Query(..., min_length=3, max_length=200, description="Customer's address or postal code"),
    radius_km: float = Query(50, gt=0, le=250, description="Maximum search distance in kilometers"),
    limit: int = Query(10, ge=1, le=50),
    service_needed: Optional[str] = Query(None, min_length=1, max_length=100),
    _: dict = Depends(require_role("consumer", "diy")),
):
    if db_instance.db is None:
        raise HTTPException(status_code=503, detail="Database is not connected.")

    try:
        customer_location = await location_service.geocode_address(address)
    except LocationProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if customer_location is None:
        raise HTTPException(status_code=404, detail="Address could not be found.")

    mechanics_collection = db_instance.db["mechanics"]
    try:
        await mechanics_collection.create_index([("location", "2dsphere")])
        mechanic_filter = {}
        if service_needed:
            mechanic_filter["services_offered"] = service_needed

        cursor = mechanics_collection.aggregate(
            [
                {
                    "$geoNear": {
                        "near": {
                            "type": "Point",
                            "coordinates": [
                                customer_location["longitude"],
                                customer_location["latitude"],
                            ],
                        },
                        "key": "location",
                        "distanceField": "distance_meters",
                        "maxDistance": radius_km * 1000,
                        "spherical": True,
                        "query": mechanic_filter,
                    }
                },
                {"$limit": limit},
                {
                    "$project": {
                        "shop_name": 1,
                        "address": 1,
                        "services_offered": 1,
                        "price_per_hour": 1,
                        "distance_meters": 1,
                    }
                },
            ]
        )
        mechanics = await cursor.to_list(length=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to search nearby mechanics.") from exc

    results = [
        {
            "mechanic_id": str(mechanic["_id"]),
            "shop_name": mechanic.get("shop_name"),
            "address": mechanic.get("address"),
            "services": mechanic.get("services_offered", []),
            "price_per_hour": mechanic.get("price_per_hour"),
            "distance_km": round(mechanic["distance_meters"] / 1000, 2),
        }
        for mechanic in mechanics
    ]

    return {
        "origin": {
            "address": customer_location["label"],
            "latitude": customer_location["latitude"],
            "longitude": customer_location["longitude"],
        },
        "radius_km": radius_km,
        "results": results,
        "attribution": "OpenStreetMap contributors",
    }