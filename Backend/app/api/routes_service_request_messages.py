import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.api.routes_service_requests import (
    CUSTOMER_APPOINTMENTS_PAGE,
    MECHANIC_REQUESTS_PAGE,
    describe_appointment,
)
from app.core.database import db_instance
from app.models.messages import MessagingView, ServiceRequestMessageCreate
from app.services.notifications import create_notification

logger = logging.getLogger("vehicle_api")

router = APIRouter(
    prefix="/api/service-requests",
    tags=["Service Request Messages"],
)

WRITABLE_STATUSES = {"pending", "accepted"}
MAX_MESSAGES_RETURNED = 500
PARTICIPANT_FIELDS = {"mechanic": "mechanic_id", "customer": "customer_id"}
OTHER_ROLE = {"mechanic": "customer", "customer": "mechanic"}
_indexes_ready = False


def get_collection(name: str):
    if db_instance.db is None:
        raise HTTPException(status_code=503, detail="Database is not connected.")
    return db_instance.db[name]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ensure_messaging_indexes():
    """One conversation per service request; messages read in send order."""
    global _indexes_ready

    if _indexes_ready:
        return

    conversations = get_collection("conversations")
    await conversations.create_index(
        [("service_request_id", 1)],
        unique=True,
        name="unique_service_request_conversation",
    )
    await conversations.create_index(
        [("customer_id", 1), ("last_message_at", -1)],
        name="customer_conversation_list",
    )
    await conversations.create_index(
        [("mechanic_id", 1), ("last_message_at", -1)],
        name="mechanic_conversation_list",
    )
    await get_collection("messages").create_index(
        [("conversation_id", 1), ("created_at", 1)],
        name="conversation_messages",
    )

    _indexes_ready = True


def require_actor_id(actor_id: str) -> str:
    actor_id = str(actor_id or "").strip()
    if not actor_id:
        raise HTTPException(status_code=400, detail="actor_id is required.")
    return actor_id


async def require_request_participant(
    request_id: str,
    actor_id: str,
    view: MessagingView,
) -> dict:
    """
    Loads the service request only when actor_id is the request's customer
    (view="customer") or mechanic (view="mechanic"); otherwise 404 so the
    request's existence isn't revealed.

    Security limitation: actor_id is client-asserted, as with the other
    service-request routes. Verifying a Firebase ID token server-side and
    taking the UID from it belongs here once it exists.
    """
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid service request ID.")

    request_document = await get_collection("service_requests").find_one(
        {
            "_id": ObjectId(request_id),
            PARTICIPANT_FIELDS[view]: require_actor_id(actor_id),
        }
    )
    if not request_document:
        raise HTTPException(status_code=404, detail="Service request not found.")
    return request_document


def request_status(request_document: dict) -> str:
    return request_document.get("status", "pending")


def require_writable(status: str):
    if status not in WRITABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"Messaging is closed because this request is {status}.",
        )


async def discard_message(messages, message_id: ObjectId):
    try:
        await messages.delete_one({"_id": message_id})
    except Exception:
        logger.exception("Failed to discard unsent message %s", message_id)


async def notify_recipient_of_message(request_document: dict, recipient_role: str):
    """Points the recipient at the request; the message body stays out of notifications."""
    request_id = str(request_document["_id"])
    service = request_document.get("service_requested") or "service"
    when = describe_appointment(request_document)

    if recipient_role == "mechanic":
        customer = request_document.get("customer_name") or "A customer"
        await create_notification(
            request_document.get("mechanic_id"),
            "New Message",
            f"{customer} sent you a message about their {service} request for {when}.",
            destination=f"{MECHANIC_REQUESTS_PAGE}?request={request_id}",
        )
        return

    shop = request_document.get("shop_name") or "MotorMate Mechanic"
    await create_notification(
        request_document.get("customer_id"),
        f"New Message from {shop}",
        f"{shop} sent you a message about your {service} request for {when}.",
        destination=f"{CUSTOMER_APPOINTMENTS_PAGE}?request={request_id}",
    )


def serialize_message(document: dict) -> dict:
    """Client-facing message. Sender UIDs never leave the server."""
    return {
        "id": str(document["_id"]),
        "sender_role": document.get("sender_role"),
        "body": document.get("body", ""),
        "kind": document.get("kind", "text"),
        "created_at": document.get("created_at"),
    }


def unread_count_for(conversation: dict | None, role: str) -> int:
    return int(((conversation or {}).get("unread_count") or {}).get(role) or 0)


async def find_or_create_conversation(request_document: dict) -> dict:
    conversations = get_collection("conversations")
    request_id = str(request_document["_id"])

    try:
        return await conversations.find_one_and_update(
            {"service_request_id": request_id},
            {
                "$setOnInsert": {
                    "context": {"type": "service_request", "id": request_id},
                    "customer_id": request_document.get("customer_id"),
                    "mechanic_id": request_document.get("mechanic_id"),
                    "created_at": now_iso(),
                    "last_message_at": None,
                    "last_message_sender_role": None,
                    "unread_count": {"customer": 0, "mechanic": 0},
                    "last_read_at": {"customer": None, "mechanic": None},
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        # Both participants sent a first message at the same moment.
        return await conversations.find_one({"service_request_id": request_id})


@router.get("/messages/summary")
async def get_message_summary(
    actor_id: str = Query(..., min_length=1),
    view: MessagingView = Query(...),
):
    """Unread counts for each of the actor's request conversations, keyed by request ID."""
    actor_id = require_actor_id(actor_id)
    await ensure_messaging_indexes()

    try:
        cursor = get_collection("conversations").find(
            {
                PARTICIPANT_FIELDS[view]: actor_id,
                "last_message_at": {"$ne": None},
            }
        )
        results = {
            conversation["service_request_id"]: {
                "unread_count": unread_count_for(conversation, view),
                "last_message_at": conversation.get("last_message_at"),
                "last_message_sender_role": conversation.get("last_message_sender_role"),
            }
            async for conversation in cursor
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve message summary.")

    return {"results": results}


@router.get("/{request_id}/messages")
async def get_request_messages(
    request_id: str,
    actor_id: str = Query(..., min_length=1),
    view: MessagingView = Query(...),
):
    """
    The request's conversation, oldest message first. Readable for every
    status; can_send is false once the request is declined or completed.
    """
    await ensure_messaging_indexes()
    request_document = await require_request_participant(request_id, actor_id, view)
    status = request_status(request_document)

    try:
        conversation = await get_collection("conversations").find_one(
            {"service_request_id": request_id}
        )
        messages = []
        if conversation:
            cursor = (
                get_collection("messages")
                .find({"conversation_id": conversation["_id"]})
                .sort([("created_at", -1), ("_id", -1)])
                .limit(MAX_MESSAGES_RETURNED)
            )
            messages = [serialize_message(item) async for item in cursor]
            messages.reverse()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve messages.")

    return {
        "service_request_id": request_id,
        "status": status,
        "can_send": status in WRITABLE_STATUSES,
        "unread_count": unread_count_for(conversation, view),
        "messages": messages,
    }


@router.post("/{request_id}/messages")
async def send_request_message(request_id: str, payload: ServiceRequestMessageCreate):
    """
    Sends a plain-text message to the other participant. Only pending and
    accepted requests accept new messages.
    """
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    await ensure_messaging_indexes()
    sender_role = payload.view
    recipient_role = OTHER_ROLE[sender_role]
    request_document = await require_request_participant(
        request_id, payload.actor_id, sender_role
    )

    require_writable(request_status(request_document))

    messages = get_collection("messages")
    try:
        conversation = await find_or_create_conversation(request_document)
        sent_at = now_iso()

        message_document = {
            "conversation_id": conversation["_id"],
            "service_request_id": request_id,
            "sender_role": sender_role,
            "sender_id": require_actor_id(payload.actor_id),
            "body": body,
            "kind": "text",
            "created_at": sent_at,
        }
        result = await messages.insert_one(message_document)
        message_document["_id"] = result.inserted_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send message.")

    # Without transactions, the saved message is removed again if the request
    # closed while it was being written or the conversation can't be updated,
    # so every kept message was written while the request was open and is
    # reflected in the unread counts.
    try:
        latest = await get_collection("service_requests").find_one(
            {"_id": request_document["_id"]}
        )
        require_writable(request_status(latest) if latest else "unavailable")

        # Sending implies the sender has seen the thread.
        before_update = await get_collection("conversations").find_one_and_update(
            {"_id": conversation["_id"]},
            {
                "$set": {
                    "last_message_at": sent_at,
                    "last_message_sender_role": sender_role,
                    f"unread_count.{sender_role}": 0,
                    f"last_read_at.{sender_role}": sent_at,
                },
                "$inc": {f"unread_count.{recipient_role}": 1},
            },
            return_document=ReturnDocument.BEFORE,
        )
        if before_update is None:
            raise RuntimeError("Conversation disappeared while sending.")
    except Exception as error:
        await discard_message(messages, message_document["_id"])
        if isinstance(error, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Failed to send message.")

    # The atomic $inc means only the message that starts an unread streak
    # sees 0 here, so a burst of messages produces one notification.
    if unread_count_for(before_update, recipient_role) == 0:
        await notify_recipient_of_message(latest, recipient_role)

    return {
        "message": "Message sent.",
        "sent_message": serialize_message(message_document),
    }


@router.patch("/{request_id}/messages/read")
async def mark_request_messages_read(
    request_id: str,
    actor_id: str = Query(..., min_length=1),
    view: MessagingView = Query(...),
):
    """Clears the actor's unread count for this request's conversation."""
    await ensure_messaging_indexes()
    await require_request_participant(request_id, actor_id, view)

    try:
        await get_collection("conversations").update_one(
            {"service_request_id": request_id},
            {
                "$set": {
                    f"unread_count.{view}": 0,
                    f"last_read_at.{view}": now_iso(),
                }
            },
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to mark messages as read.")

    return {"message": "Conversation marked as read.", "unread_count": 0}
