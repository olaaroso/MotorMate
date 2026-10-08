from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database import db_instance

router = APIRouter(prefix="/api/diy", tags=["DIY Marketplace"])


class DIYListingCreate(BaseModel):
    seller_name: str
    item_name: str
    category: str
    condition: str = "used"
    price: float = Field(..., gt=0)
    distance: float = Field(default=2.5, ge=0.0)
    zip_code: str = "11735"
    availability: str = "available"
    description: Optional[str] = None
    rating: float = 4.9
    reviews: int = 15


class DIYListingResponse(DIYListingCreate):
    id: str


DEFAULT_SEED_LISTINGS = [
    {
        "seller_name": "Mike R.",
        "item_name": "3-Ton Floor Jack",
        "category": "Lifting",
        "price": 18.0,
        "distance": 1.2,
        "rating": 4.9,
        "reviews": 24,
        "zip_code": "11735",
        "availability": "available",
    },
    {
        "seller_name": "Alex T.",
        "item_name": "Cordless Impact Wrench",
        "category": "Power Tools",
        "price": 14.0,
        "distance": 2.4,
        "rating": 4.8,
        "reviews": 18,
        "zip_code": "11735",
        "availability": "available",
    },
    {
        "seller_name": "Chris M.",
        "item_name": "OBD-II Diagnostic Scanner",
        "category": "Diagnostics",
        "price": 12.0,
        "distance": 3.1,
        "rating": 5.0,
        "reviews": 31,
        "zip_code": "11735",
        "availability": "available",
    },
    {
        "seller_name": "Daniel S.",
        "item_name": "Mechanic Tool Set",
        "category": "Hand Tools",
        "price": 16.0,
        "distance": 3.8,
        "rating": 4.7,
        "reviews": 15,
        "zip_code": "11735",
        "availability": "available",
    },
]


@router.get("/listings")
async def list_listings(
        sort_by: str = "distance",
        order: str = "asc",
        category: Optional[str] = None,
        search: Optional[str] = None,
):
    field = "price" if sort_by == "price" else "distance"
    sort_direction = 1 if order == "asc" else -1

    if db_instance.db is not None:
        try:
            tools_collection = db_instance.db["tool_listings"]

            if await tools_collection.count_documents({}) == 0:
                await tools_collection.insert_many([dict(t) for t in DEFAULT_SEED_LISTINGS])

            filter_query = {}
            if category and category.lower() != "all":
                filter_query["category"] = {"$regex": f"^{category}$", "$options": "i"}
            if search:
                filter_query["item_name"] = {"$regex": search, "$options": "i"}

            cursor = tools_collection.find(filter_query).sort(field, sort_direction)
            results = []
            async for tool in cursor:
                tool["id"] = str(tool["_id"])
                del tool["_id"]
                results.append(tool)

            return {"results": results}
        except Exception as e:
            print(f"MongoDB query failed, using in-memory sort: {e}")

    filtered = [
        t for t in DEFAULT_SEED_LISTINGS
        if (not category or category == "All" or t["category"].lower() == category.lower())
           and (not search or search.lower() in t["item_name"].lower())
    ]
    filtered.sort(key=lambda x: x[field], reverse=(sort_direction == -1))
    return {"results": filtered}


@router.post("/listings")
async def create_listing(payload: DIYListingCreate):
    if db_instance.db is not None:
        tools_collection = db_instance.db["tool_listings"]
        doc = payload.model_dump()
        result = await tools_collection.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        return doc
    return payload.model_dump()