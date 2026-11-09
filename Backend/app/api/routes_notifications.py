
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from app.core.database import db_instance

router = APIRouter()

# Matches documents where cleared_at is missing or null, so notifications
# created before clearing existed stay in the normal view.
NOT_CLEARED = {"cleared_at": None}

ALLOWED_DESTINATIONS = (
    "/myTools",
    "/rentals",
    "/mechanic/requests",
    "/appointments",
)


def get_notifications_collection():
    if db_instance.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not connected."
        )
    return db_instance.db["notifications"]


def get_destination(document: dict) -> str:
    # Prefer explicit destinations for future notifications.
    destination = document.get("destination")
    if destination in ALLOWED_DESTINATIONS:
        return destination

    title = document.get("title", "")
    message = document.get("message", "")

    # Notifications received by tool owners
    if title == "New Rental Request!":
        return "/myTools"

    if title == "Rental Cancelled" and message.startswith(
        "The borrower cancelled"
    ):
        return "/myTools"

    if title in (
        "Tool Pickup Confirmed",
        "Tool Return Awaiting Confirmation",
    ):
        return "/myTools"

    # Notifications received by renters, and legacy fallback
    return "/rentals"


def serialize_mongo_document(document: dict):
    document["id"] = str(document["_id"])
    document.pop("_id", None)
    document["destination"] = get_destination(document)
    return document


def parse_notification_id(notification_id: str) -> ObjectId:
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid notification ID."
        )
    return ObjectId(notification_id)


def require_user_id(user_id: str) -> str:
    user_id = user_id.strip()
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="user_id is required."
        )
    return user_id


@router.get("/{user_id}")
async def get_user_notifications(
    user_id: str,
    include_cleared: bool = Query(default=False),
):
    """
    Fetch a user's notifications, newest first.

    Cleared notifications are hidden from the normal view but are never
    deleted; pass include_cleared=true to read the full history.
    """
    collection = get_notifications_collection()

    query = {"user_id": user_id}
    if not include_cleared:
        query.update(NOT_CLEARED)

    cursor = collection.find(query).sort("created_at", -1)

    results = []
    async for doc in cursor:
        results.append(serialize_mongo_document(doc))

    return results


@router.patch("/user/{user_id}/clear-all")
async def clear_all_notifications(user_id: str):
    """Clear every visible notification for a user, keeping them in history."""
    user_id = require_user_id(user_id)
    collection = get_notifications_collection()

    result = await collection.update_many(
        {"user_id": user_id, **NOT_CLEARED},
        {
            "$set": {
                "is_read": True,
                "cleared_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )

    return {
        "message": "All notifications cleared.",
        "modified_count": result.modified_count
    }


@router.patch("/user/{user_id}/read-all")
async def mark_all_notifications_as_read(user_id: str):
    """Mark all unread notifications for a user as read."""
    collection = get_notifications_collection()

    result = await collection.update_many(
        {
            "user_id": user_id,
            "is_read": False
        },
        {
            "$set": {"is_read": True}
        }
    )

    return {
        "message": "All notifications marked as read.",
        "modified_count": result.modified_count
    }


@router.patch("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    user_id: str = Query(..., min_length=1),
):
    """Mark one of the user's notifications as read."""
    notification_object_id = parse_notification_id(notification_id)
    user_id = require_user_id(user_id)
    collection = get_notifications_collection()
    owned_filter = {"_id": notification_object_id, "user_id": user_id}

    result = await collection.update_one(
        owned_filter,
        {"$set": {"is_read": True}}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found."
        )

    updated_doc = await collection.find_one(owned_filter)

    return serialize_mongo_document(updated_doc)


@router.patch("/{notification_id}/clear")
async def clear_notification(
    notification_id: str,
    user_id: str = Query(..., min_length=1),
):
    """Hide one notification from the normal view, keeping it in history."""
    notification_object_id = parse_notification_id(notification_id)
    user_id = require_user_id(user_id)
    collection = get_notifications_collection()
    owned_filter = {"_id": notification_object_id, "user_id": user_id}

    existing = await collection.find_one(owned_filter)
    if existing is None:
        raise HTTPException(
            status_code=404,
            detail="Notification not found."
        )

    if existing.get("cleared_at") is None:
        await collection.update_one(
            owned_filter,
            {
                "$set": {
                    "is_read": True,
                    "cleared_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        )

    updated_doc = await collection.find_one(owned_filter)

    return serialize_mongo_document(updated_doc)
