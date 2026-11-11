from datetime import datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.routes_diy import get_rental_requests_collection
from app.core.database import db_instance

router = APIRouter(prefix="/api/diy/rental-messages", tags=["Rental Messages"])

RentalRole = Literal["owner", "borrower"]
PARTICIPANT_FIELDS = {"owner": "owner_id", "borrower": "renter_id"}
CLOSED_STATUSES = {"completed", "cancelled", "rejected"}
MAX_MESSAGES_RETURNED = 500


class MessagePayload(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)


def get_messages_collection():
    if db_instance.db is None:
        raise HTTPException(status_code=503, detail="Database is not connected.")
    return db_instance.db["tool_rental_messages"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_message(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "rental_id": str(document.get("rental_id", "")),
        "sender_id": str(document.get("sender_id", "")),
        "sender_role": document.get("sender_role"),
        "body": document.get("body", ""),
        "created_at": document.get("created_at"),
        "read_at": document.get("read_at"),
    }


async def require_rental_participant(
        rental_id: str,
        actor_id: str,
        role: RentalRole,
) -> dict:
    if not ObjectId.is_valid(rental_id):
        raise HTTPException(status_code=400, detail="Invalid rental request ID.")

    actor_id = actor_id.strip()
    if not actor_id:
        raise HTTPException(status_code=400, detail="actor_id is required.")

    rentals = get_rental_requests_collection()
    rental = await rentals.find_one({"_id": ObjectId(rental_id)})
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found.")

    expected_actor = str(rental.get(PARTICIPANT_FIELDS[role]) or "").strip()
    if expected_actor != actor_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this thread.")

    return rental


@router.get("/{rental_id}")
async def get_rental_thread(
        rental_id: str,
        actor_id: str = Query(..., min_length=1),
        role: RentalRole = Query(...),
):
    rental = await require_rental_participant(rental_id, actor_id, role)
    messages_collection = get_messages_collection()

    cursor = (
        messages_collection.find({"rental_id": rental_id})
        .sort([("created_at", 1), ("_id", 1)])
        .limit(MAX_MESSAGES_RETURNED)
    )
    raw_messages = await cursor.to_list(length=MAX_MESSAGES_RETURNED)

    unread_count = sum(
        1
        for msg in raw_messages
        if msg.get("sender_role") != role and msg.get("read_at") is None
    )

    status = str(rental.get("status") or "pending")
    can_send = status not in CLOSED_STATUSES

    return {
        "messages": [serialize_message(msg) for msg in raw_messages],
        "unread_count": unread_count,
        "can_send": can_send,
        "status": status,
    }


@router.post("/{rental_id}")
async def send_rental_message(
        rental_id: str,
        actor_id: str = Query(..., min_length=1),
        role: RentalRole = Query(...),
        payload: MessagePayload = Body(...),
):
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    rental = await require_rental_participant(rental_id, actor_id, role)
    status = str(rental.get("status") or "pending")
    if status in CLOSED_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Messaging is closed because this rental is {status}.",
        )

    sent_at = now_iso()
    message_doc = {
        "rental_id": rental_id,
        "sender_id": actor_id.strip(),
        "sender_role": role,
        "body": body,
        "created_at": sent_at,
        "read_at": None,
    }

    messages_collection = get_messages_collection()
    result = await messages_collection.insert_one(message_doc)
    message_doc["_id"] = result.inserted_id

    recipient_id = rental.get("renter_id" if role == "owner" else "owner_id")
    sender_name = rental.get("seller_name" if role == "owner" else "renter_name") or "MotorMate User"
    tool_name = rental.get("tool_name") or "Tool"

    if recipient_id and db_instance.db is not None:
        try:
            await db_instance.db["notifications"].insert_one(
                {
                    "user_id": recipient_id,
                    "title": f"New Message from {sender_name}",
                    "message": f"{sender_name} sent a message about {tool_name}.",
                    "is_read": False,
                    "created_at": sent_at,
                }
            )
        except Exception:
            pass

    return serialize_message(message_doc)


@router.patch("/{rental_id}/read")
async def mark_rental_thread_read(
        rental_id: str,
        actor_id: str = Query(..., min_length=1),
        role: RentalRole = Query(...),
):
    await require_rental_participant(rental_id, actor_id, role)
    messages_collection = get_messages_collection()

    result = await messages_collection.update_many(
        {
            "rental_id": rental_id,
            "sender_role": {"$ne": role},
            "read_at": None,
        },
        {"$set": {"read_at": now_iso()}},
    )
    return {"modified_count": result.modified_count, "unread_count": 0}