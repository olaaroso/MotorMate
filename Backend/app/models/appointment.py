from datetime import date as date_type

from pydantic import BaseModel, Field


class AppointmentSlotCreate(BaseModel):
    """
    Payload for a mechanic adding a single appointment slot.

    `time` is stored as 24-hour "HH:MM" so slots sort correctly with a
    plain string compare (matching how ToolDrop stores ISO dates).
    The frontend is responsible for displaying it as "10:00 AM".
    """

    date: date_type
    time: str = Field(
        ...,
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$",
        description="24-hour time in HH:MM format, e.g. 09:30 or 14:00",
    )
