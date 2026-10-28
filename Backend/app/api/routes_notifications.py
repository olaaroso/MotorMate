
from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.core.database import db_instance

router = APIRouter()


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
    if destination in ("/myTools", "/rentals"):
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


@router.get("/{user_id}")
async def get_user_notifications(user_id: str):
    """Fetch a user's notifications, newest first."""
    collection = get_notifications_collection()

    cursor = collection.find(
        {"user_id": user_id}
    ).sort("created_at", -1)

    results = []
    async for doc in cursor:
        results.append(serialize_mongo_document(doc))

    return results


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
async def mark_notification_as_read(notification_id: str):
    """Mark a specific notification as read."""
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid notification ID."
        )

    collection = get_notifications_collection()

    result = await collection.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"is_read": True}}
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found."
        )

    updated_doc = await collection.find_one(
        {"_id": ObjectId(notification_id)}
    )

    return serialize_mongo_document(updated_doc)
