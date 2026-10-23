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


class ServiceRequestCreate(BaseModel):
    """
    Payload for a car owner requesting one of a mechanic's appointment
    slots. The mechanic, shop details and appointment date/time are looked
    up from the slot on the server, so the client cannot supply them.
    """

    slot_id: str = Field(..., min_length=1)
    customer_id: str = Field(..., min_length=1)
    customer_name: str = Field(..., min_length=1, max_length=120)
    vehicle_id: str = Field(..., min_length=1)
    service_requested: str = Field(..., min_length=1, max_length=100)
    problem_description: str = Field(..., min_length=10, max_length=1000)
