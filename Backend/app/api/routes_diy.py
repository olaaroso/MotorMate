from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/diy", tags=["DIY Marketplace"])


class DIYListingCreate(BaseModel):
    seller_name: str
    item_name: str
    category: str
    condition: str = "used"
    price: float = Field(..., gt=0)
    zip_code: str
    availability: str = "available"
    description: Optional[str] = None


class DIYListing(DIYListingCreate):
    listing_id: Optional[str] = None
    rating: float = 5.0


LISTINGS: List[DIYListing] = []


@router.post("/listings", response_model=DIYListing)
async def create_listing(payload: DIYListingCreate):
    new_listing = DIYListing(**payload.model_dump(), listing_id=f"listing-{len(LISTINGS) + 1}")
    LISTINGS.append(new_listing)
    return new_listing


@router.get("/listings")
async def list_listings(zip_code: Optional[str] = Query(None), category: Optional[str] = Query(None)):
    records = LISTINGS
    if zip_code:
        records = [listing for listing in records if listing.zip_code == zip_code]
    if category:
        records = [listing for listing in records if listing.category.lower() == category.lower()]
    return {"results": records}


@router.get("/health")
async def diy_health():
    return {"status": "ok", "items_count": len(LISTINGS)}