import logging
from datetime import datetime, timezone
from typing import Optional

from app.core.database import db_instance

logger = logging.getLogger("vehicle_api")


async def create_notification(
    user_id: str,
    title: str,
    message: str,
    destination: Optional[str] = None,
) -> bool:
    """
    Best-effort insert into the shared notifications collection.

    Callers create notifications after their own state change has already
    succeeded, so a notification failure must never turn that action into an
    error response. Returns whether the notification was stored.
    """
    user_id = str(user_id or "").strip()
    if not user_id or db_instance.db is None:
        return False

    document = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if destination:
        document["destination"] = destination

    try:
        await db_instance.db["notifications"].insert_one(document)
        return True
    except Exception:
        logger.exception("Failed to create notification for user %s", user_id)
        return False
