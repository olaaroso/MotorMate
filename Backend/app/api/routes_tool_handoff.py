"""ToolDrop pickup and return instructions, without Firebase Admin.

COURSE PROJECT / DEMO: this version does NOT authenticate callers. Pickup
addresses and handoff instructions may be requested by anyone who knows an
approved rental ID. Listing edits only check the supplied owner_id, which
can be spoofed. Do NOT deploy with real home addresses to a public server.
Original /api/diy/rental-requests/{id}/approve remains unchanged.
"""
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database import db_instance
from app.api.routes_diy import get_tools_collection, get_rental_requests_collection

router = APIRouter(prefix="/api/diy/handoff", tags=["ToolDrop Handoff"])
FIELDS = ("pickup_address", "pickup_instructions", "dropoff_instructions")


def database():
    if db_instance.db is None:
        raise HTTPException(503, "Database unavailable")
    return db_instance.db


class HandoffDetails(BaseModel):
    pickup_address: str = Field(default="", max_length=300)
    pickup_instructions: str = Field(default="", max_length=1200)
    dropoff_instructions: str = Field(default="", max_length=1200)


def cleaned(payload: HandoffDetails):
    return {key: str(value).strip() for key, value in payload.model_dump().items()}


@router.get("/listings/{listing_id}")
async def get_listing_handoff(listing_id: str, owner_id: str = Query(...)):
    if not ObjectId.is_valid(listing_id):
        raise HTTPException(400, "Invalid listing ID")
    listing = await get_tools_collection().find_one({"_id": ObjectId(listing_id), "owner_id": owner_id})
    if listing is None:
        raise HTTPException(404, "Listing not found for this owner")
    data = await database()["tool_handoff_details"].find_one({"listing_id": listing_id}) or {}
    return {field: data.get(field, "") for field in FIELDS}


@router.put("/listings/{listing_id}")
async def save_listing_handoff(listing_id: str, payload: HandoffDetails, owner_id: str = Query(...)):
    if not ObjectId.is_valid(listing_id):
        raise HTTPException(400, "Invalid listing ID")
    listing = await get_tools_collection().find_one({"_id": ObjectId(listing_id), "owner_id": owner_id})
    if listing is None:
        raise HTTPException(404, "Listing not found for this owner")
    data = cleaned(payload)
    await database()["tool_handoff_details"].update_one(
        {"listing_id": listing_id},
        {"$set": {**data, "listing_id": listing_id, "owner_id": owner_id,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"message": "Pickup and drop-off details saved", **data}


@router.put("/defaults/{owner_id}")
async def save_owner_defaults(owner_id: str, payload: HandoffDetails):
    """Course project: mirror the owner's Firestore defaults for rental fallback.

    This demo endpoint intentionally does not authenticate callers. Do not use
    with actual home addresses or deploy as a public service.
    """
    if not owner_id.strip():
        raise HTTPException(400, "Owner ID required")
    values = cleaned(payload)
    await database()["owner_handoff_defaults"].update_one(
        {"owner_id": owner_id},
        {"$set": {"owner_id": owner_id, **values,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"message": "Owner defaults synchronized", **values}


def resolved_handoff(snapshot: dict, listing: dict, defaults: dict) -> dict:
    """Order override > listing override > account defaults, per field."""
    return {
        field: str((snapshot or {}).get(field)
                   or (listing or {}).get(field)
                   or (defaults or {}).get(field)
                   or "")
        for field in FIELDS
    }


async def listing_and_owner_defaults(rental: dict):
    db = database()
    listing_id = str(rental.get("listing_id", ""))
    listing = await db["tool_handoff_details"].find_one({"listing_id": listing_id}) or {}
    defaults = await db["owner_handoff_defaults"].find_one({"owner_id": str(rental.get("owner_id", ""))}) or {}
    return listing, defaults


async def snapshot_handoff_for_rental(rental_id: str, listing_id: str) -> None:
    """Freeze existing defaults on first approved-rental read when available.

    Do NOT create empty snapshots: owners may sync their Firestore defaults later.
    """
    db = database()
    rental = await get_rental_requests_collection().find_one({"_id": ObjectId(rental_id)})
    if not rental:
        return
    listing, defaults = await listing_and_owner_defaults(rental)
    data = resolved_handoff({}, listing, defaults)
    if not any(data.values()):
        return
    await db["rental_handoff_snapshots"].update_one(
        {"rental_id": rental_id},
        {"$setOnInsert": {"rental_id": rental_id, "listing_id": listing_id,
                          **data, "saved_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


@router.get("/rentals/{rental_id}")
async def get_rental_handoff(rental_id: str):
    if not ObjectId.is_valid(rental_id):
        raise HTTPException(400, "Invalid rental ID")
    rental = await get_rental_requests_collection().find_one({"_id": ObjectId(rental_id)})
    if rental is None:
        raise HTTPException(404, "Rental not found")
    if rental.get("status") in ("pending", "rejected", "cancelled"):
        raise HTTPException(403, "Handoff details are only available for approved rentals")
    db = database()
    snapshot = await db["rental_handoff_snapshots"].find_one({"rental_id": rental_id})
    listing, defaults = await listing_and_owner_defaults(rental)
    # Older records may contain empty snapshots created before defaults were
    # configured. Never force an extra Save-for-This-Rental click.
    data = resolved_handoff(snapshot or {}, listing, defaults)
    if not snapshot and any(data.values()):
        await snapshot_handoff_for_rental(rental_id, str(rental.get("listing_id", "")))
    elif snapshot and any(not snapshot.get(field) and data[field] for field in FIELDS):
        # Backfill only missing fields, preserving each existing order override.
        missing = {field: data[field] for field in FIELDS if not snapshot.get(field) and data[field]}
        if missing:
            await db["rental_handoff_snapshots"].update_one(
                {"rental_id": rental_id}, {"$set": missing}
            )
    return data


@router.put("/rentals/{rental_id}")
async def update_rental_handoff(rental_id: str, payload: HandoffDetails, owner_id: str = Query(...)):
    """Demo-only: change pickup/return details for one approved rental.

    This endpoint has NO identity verification; the owner_id query is spoofable.
    Do not deploy publicly with real addresses or use for production.
    """
    if not ObjectId.is_valid(rental_id):
        raise HTTPException(400, "Invalid rental ID")
    rental = await get_rental_requests_collection().find_one({
        "_id": ObjectId(rental_id), "owner_id": owner_id,
    })
    if rental is None:
        raise HTTPException(404, "Rental not found for this owner")
    if rental.get("status") not in ("approved", "pickup_pending"):
        raise HTTPException(409, "Instructions may only be changed before borrower pickup is complete")
    data = cleaned(payload)
    if not data["pickup_address"]:
        raise HTTPException(400, "Pickup address is required")
    await database()["rental_handoff_snapshots"].update_one(
        {"rental_id": rental_id},
        {"$set": {**data, "rental_id": rental_id,
                  "listing_id": str(rental.get("listing_id", "")),
                  "updated_at": datetime.now(timezone.utc).isoformat(),
                  "updated_by": owner_id}},
        upsert=True,
    )
    return {"message": "Saved for this rental only", **data}
