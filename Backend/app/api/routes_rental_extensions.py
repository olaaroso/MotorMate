"""Borrower-requested ToolDrop rental extensions with owner approval.

Mount this router in app/main.py. Approved bookings are exclusive and cannot
be displaced by an extension. Only the currently active borrower can request.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.database import db_instance
from app.api.routes_diy import get_rental_requests_collection, serialize_mongo_document

router = APIRouter(prefix="/api/diy", tags=["DIY Rental Extensions"])
BLOCKING_STATUSES = ["approved", "pickup_pending", "active", "return_pending"]
WINDOW_DAYS = 60


class ExtensionRequest(BaseModel):
    renter_id: str
    requested_end_date: date


class ExtensionDecision(BaseModel):
    owner_id: str
    approve: bool


def _id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(400, "Invalid rental ID.")
    return ObjectId(value)


async def _rental(request_id: str) -> dict:
    rental = await get_rental_requests_collection().find_one({"_id": _id(request_id)})
    if rental is None:
        raise HTTPException(404, "Rental not found.")
    return rental


async def _conflict(rental: dict, requested_end: str) -> Optional[dict]:
    """Date strings are ISO YYYY-MM-DD; lexicographic bounds are valid."""
    return await get_rental_requests_collection().find_one({
        "_id": {"$ne": rental["_id"]},
        "listing_id": str(rental.get("listing_id", "")),
        "status": {"$in": BLOCKING_STATUSES},
        "start_date": {"$lte": requested_end},
        "end_date": {"$gte": str(rental.get("end_date", ""))},
    })


async def _notify(user_id: str, title: str, message: str):
    if not user_id:
        return
    try:
        await db_instance.db["notifications"].insert_one({
            "user_id": user_id,
            "title": title,
            "message": message,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        # A notification outage must not revert the saved request or decision.
        pass


@router.get("/rental-requests/{request_id}/extension-availability")
async def extension_availability(request_id: str, renter_id: str):
    rental = await _rental(request_id)
    if rental.get("renter_id") != renter_id.strip():
        raise HTTPException(403, "Only the borrower can check this rental.")
    if rental.get("status") != "active":
        raise HTTPException(409, "Only tools currently in the borrower's possession may be extended.")
    current_end = date.fromisoformat(str(rental["end_date"]))
    first_day = current_end + timedelta(days=1)
    horizon = max(first_day, min(current_end + timedelta(days=WINDOW_DAYS), date.today() + timedelta(days=WINDOW_DAYS)))
    # Find the earliest future confirmed booking, excluding this rental.
    cursor = get_rental_requests_collection().find({
        "_id": {"$ne": rental["_id"]},
        "listing_id": str(rental.get("listing_id", "")),
        "status": {"$in": BLOCKING_STATUSES},
        "start_date": {"$lte": horizon.isoformat()},
        "end_date": {"$gte": first_day.isoformat()},
    }).sort("start_date", 1)
    next_booking = None
    async for booked in cursor:
        next_booking = booked
        break
    available_through = horizon
    if next_booking is not None:
        next_start = date.fromisoformat(str(next_booking["start_date"]))
        available_through = min(horizon, next_start - timedelta(days=1))
    can_extend = available_through >= first_day
    extension = rental.get("extension_request") or {}
    return {
        "rental_id": request_id,
        "current_end_date": current_end.isoformat(),
        "first_extension_day": first_day.isoformat(),
        "available_through": available_through.isoformat() if can_extend else None,
        "next_booking_start": next_booking.get("start_date") if next_booking else None,
        "can_extend": can_extend,
        "daily_rate": float(rental.get("daily_rate", 0)),
        "pending_request": extension if extension.get("status") == "pending" else None,
        "message": ("Sorry, an extension is unavailable. This tool has already been booked "
                    "for the day after your return date." if not can_extend else
                    "Select an available new return date and send it to the owner for approval."),
    }


@router.post("/rental-requests/{request_id}/extension")
async def request_extension(request_id: str, payload: ExtensionRequest):
    rental = await _rental(request_id)
    if rental.get("renter_id") != payload.renter_id.strip():
        raise HTTPException(403, "Only the borrower can request an extension.")
    if rental.get("status") != "active":
        raise HTTPException(409, "Rental must be active and in your possession.")
    if (rental.get("extension_request") or {}).get("status") == "pending":
        raise HTTPException(409, "An extension request is already waiting for the owner.")
    old_end = date.fromisoformat(str(rental["end_date"]))
    new_end = payload.requested_end_date
    if new_end <= old_end or new_end <= date.today():
        raise HTTPException(400, "Select a future return date later than the current return date.")
    if (new_end - old_end).days > WINDOW_DAYS:
        raise HTTPException(400, "Request at most 60 additional days per extension.")
    if await _conflict(rental, new_end.isoformat()):
        raise HTTPException(409, "Sorry, the requested extension overlaps an already approved booking.")
    now = datetime.now(timezone.utc).isoformat()
    extension = {"status": "pending", "original_end_date": old_end.isoformat(),
                 "requested_end_date": new_end.isoformat(), "requested_at": now}
    result = await get_rental_requests_collection().update_one({
        "_id": rental["_id"], "renter_id": payload.renter_id.strip(), "status": "active",
        "end_date": old_end.isoformat(), "extension_request.status": {"$ne": "pending"},
    }, {"$set": {"extension_request": extension}})
    if not result.modified_count:
        raise HTTPException(409, "Rental changed. Refresh and try again.")
    await _notify(str(rental.get("owner_id", "")), "Rental Extension Requested",
                  f"{rental.get('renter_name', 'A borrower')} requested to keep {rental.get('tool_name','your tool')} until {new_end.isoformat()}.")
    return {"message": "Extension request sent to the tool owner.", "extension_request": extension}


@router.patch("/rental-requests/{request_id}/extension/decision")
async def decide_extension(request_id: str, payload: ExtensionDecision):
    rental = await _rental(request_id)
    if rental.get("owner_id") != payload.owner_id.strip():
        raise HTTPException(403, "Only the tool owner may decide extensions.")
    extension = rental.get("extension_request") or {}
    if rental.get("status") != "active" or extension.get("status") != "pending":
        raise HTTPException(409, "No pending extension exists on an active rental.")
    new_end = date.fromisoformat(str(extension["requested_end_date"]))
    old_end = date.fromisoformat(str(rental["end_date"]))
    if new_end <= old_end:
        raise HTTPException(409, "The requested return date is no longer valid.")
    if payload.approve:
        if new_end <= date.today():
            raise HTTPException(409, "The requested return date has passed. Ask the borrower to request another date.")
        if await _conflict(rental, new_end.isoformat()):
            raise HTTPException(409, "Cannot approve: another rental is already booked for those dates.")
    now = datetime.now(timezone.utc).isoformat()
    updates = {"extension_request.status": "approved" if payload.approve else "declined",
               "extension_request.decided_at": now}
    if payload.approve:
        updates["end_date"] = new_end.isoformat()
        extra_days = (new_end - old_end).days
        daily_rate = rental.get("daily_rate")
        if daily_rate is not None:
            extra_cost = round(float(daily_rate) * extra_days, 2)
            updates["rental_price"] = round(float(rental.get("rental_price", 0)) + extra_cost, 2)
            if rental.get("total_with_deposit") is not None:
                updates["total_with_deposit"] = round(float(rental["total_with_deposit"]) + extra_cost, 2)
            if rental.get("rental_days") is not None:
                updates["rental_days"] = int(rental["rental_days"]) + extra_days
    # CAS prevents stale owner decisions and duplicated approvals.
    updated = await get_rental_requests_collection().find_one_and_update({
        "_id": rental["_id"], "owner_id": payload.owner_id.strip(), "status": "active",
        "end_date": old_end.isoformat(), "extension_request.status": "pending",
        "extension_request.requested_at": extension["requested_at"],
    }, {"$set": updates}, return_document=True)
    if not updated:
        raise HTTPException(409, "Rental or extension changed. Refresh and retry.")
    await _notify(str(rental.get("renter_id", "")),
                  "Rental Extension Approved" if payload.approve else "Rental Extension Declined",
                  (f"Your return date for {rental.get('tool_name','the tool')} is now {new_end.isoformat()}." if payload.approve
                   else f"Your extension request for {rental.get('tool_name','the tool')} was declined."))
    return {"message": "Extension approved." if payload.approve else "Extension declined.",
            "request": serialize_mongo_document(updated)}
