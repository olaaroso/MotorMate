from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.database import db_instance


router = APIRouter(
    prefix="/api/diy",
    tags=["DIY Marketplace"],
)


class DIYListingCreate(BaseModel):
    owner_id: str
    seller_name: str

    item_name: str
    category: str
    condition: str = "used"

    price: float = Field(..., gt=0)
    deposit: float = Field(default=0, ge=0)

    location: str
    zip_code: str = "11735"

    availability: str = "available"

    description: Optional[str] = None
    specifications: Optional[str] = None

    photo_urls: List[str] = []

    distance: float = Field(default=2.5, ge=0.0)

    rating: float = 4.9
    reviews: int = 0


class DIYListingUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    condition: Optional[str] = None

    price: Optional[float] = Field(default=None, gt=0)
    deposit: Optional[float] = Field(default=None, ge=0)

    location: Optional[str] = None
    zip_code: Optional[str] = None

    availability: Optional[str] = None

    description: Optional[str] = None
    specifications: Optional[str] = None

    photo_urls: Optional[List[str]] = None


DEFAULT_SEED_LISTINGS = [
    {
        "owner_id": "seed-user-1",
        "seller_name": "Mike R.",
        "item_name": "3-Ton Floor Jack",
        "category": "Lifting",
        "condition": "Good",
        "price": 18.0,
        "deposit": 40.0,
        "distance": 1.2,
        "rating": 4.9,
        "reviews": 24,
        "location": "Farmingdale, NY",
        "zip_code": "11735",
        "availability": "available",
        "description": "Heavy-duty floor jack suitable for most passenger vehicles.",
        "specifications": "3-ton capacity",
        "photo_urls": [],
    },
    {
        "owner_id": "seed-user-2",
        "seller_name": "Alex T.",
        "item_name": "Cordless Impact Wrench",
        "category": "Power Tools",
        "condition": "Excellent",
        "price": 14.0,
        "deposit": 35.0,
        "distance": 2.4,
        "rating": 4.8,
        "reviews": 18,
        "location": "Farmingdale, NY",
        "zip_code": "11735",
        "availability": "available",
        "description": "Cordless impact wrench with battery and charger.",
        "specifications": "1/2-inch drive",
        "photo_urls": [],
    },
    {
        "owner_id": "seed-user-3",
        "seller_name": "Chris M.",
        "item_name": "OBD-II Diagnostic Scanner",
        "category": "Diagnostics",
        "condition": "Like New",
        "price": 12.0,
        "deposit": 25.0,
        "distance": 3.1,
        "rating": 5.0,
        "reviews": 31,
        "location": "Farmingdale, NY",
        "zip_code": "11735",
        "availability": "available",
        "description": "OBD-II scanner for reading and clearing diagnostic trouble codes.",
        "specifications": "Works with OBD-II vehicles",
        "photo_urls": [],
    },
]


def get_tools_collection():
    if db_instance.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected.",
        )

    return db_instance.db["tool_listings"]


@router.get("/listings")
async def list_listings(
    sort_by: str = "distance",
    order: str = "asc",
    category: Optional[str] = None,
    search: Optional[str] = None,
):
    tools_collection = get_tools_collection()

    try:
        if await tools_collection.count_documents({}) == 0:
            await tools_collection.insert_many(
                [dict(tool) for tool in DEFAULT_SEED_LISTINGS]
            )

        filter_query = {}

        if category and category.lower() != "all":
            filter_query["category"] = {
                "$regex": f"^{category}$",
                "$options": "i",
            }

        if search:
            filter_query["item_name"] = {
                "$regex": search,
                "$options": "i",
            }

        allowed_sort_fields = {
            "price": "price",
            "distance": "distance",
            "rating": "rating",
        }

        field = allowed_sort_fields.get(
            sort_by,
            "distance",
        )

        sort_direction = 1 if order == "asc" else -1

        cursor = tools_collection.find(
            filter_query
        ).sort(
            field,
            sort_direction,
        )

        results = []

        async for tool in cursor:
            tool["id"] = str(tool["_id"])
            tool.pop("_id", None)
            results.append(tool)

        return {
            "results": results,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve listings: {str(exc)}",
        )


@router.get("/listings/owner/{owner_id}")
async def get_owner_listings(
    owner_id: str,
):
    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    tools_collection = get_tools_collection()

    try:
        cursor = tools_collection.find(
            {
                "owner_id": owner_id,
            }
        )

        results = []

        async for tool in cursor:
            tool["id"] = str(tool["_id"])
            tool.pop("_id", None)
            results.append(tool)

        return {
            "count": len(results),
            "results": results,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve owner listings: {str(exc)}",
        )


@router.post("/listings")
async def create_listing(
    payload: DIYListingCreate,
):
    tools_collection = get_tools_collection()

    if not payload.owner_id.strip():
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    try:
        doc = payload.model_dump()

        result = await tools_collection.insert_one(
            doc
        )

        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)

        return {
            "message": "Listing created successfully.",
            "listing": doc,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create listing: {str(exc)}",
        )


@router.put("/listings/{listing_id}")
async def update_listing(
    listing_id: str,
    owner_id: str,
    payload: DIYListingUpdate,
):
    if not ObjectId.is_valid(listing_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid listing ID.",
        )

    if not owner_id.strip():
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    tools_collection = get_tools_collection()

    updates = payload.model_dump(
        exclude_none=True
    )

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No listing changes were provided.",
        )

    try:
        result = await tools_collection.update_one(
            {
                "_id": ObjectId(listing_id),
                "owner_id": owner_id,
            },
            {
                "$set": updates,
            },
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Listing not found or you do not own this listing.",
            )

        updated_listing = await tools_collection.find_one(
            {
                "_id": ObjectId(listing_id),
                "owner_id": owner_id,
            }
        )

        updated_listing["id"] = str(
            updated_listing["_id"]
        )

        updated_listing.pop(
            "_id",
            None,
        )

        return {
            "message": "Listing updated successfully.",
            "listing": updated_listing,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update listing: {str(exc)}",
        )


@router.delete("/listings/{listing_id}")
async def delete_listing(
    listing_id: str,
    owner_id: str,
):
    if not ObjectId.is_valid(listing_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid listing ID.",
        )

    if not owner_id.strip():
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    tools_collection = get_tools_collection()

    try:
        result = await tools_collection.delete_one(
            {
                "_id": ObjectId(listing_id),
                "owner_id": owner_id,
            }
        )

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Listing not found or you do not own this listing.",
            )

        return {
            "message": "Listing deleted successfully.",
            "listing_id": listing_id,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete listing: {str(exc)}",
        )