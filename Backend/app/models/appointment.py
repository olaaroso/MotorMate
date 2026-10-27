from datetime import date as date_type
from typing import Literal, Optional

from pydantic import BaseModel, Field

ServiceRequestStatus = Literal[
    "pending",
    "accepted",
    "declined",
    "completed",
]


class ServiceRequestCreate(BaseModel):
    """
    Payload for a car owner requesting a 30-minute appointment window at a
    mechanic's shop. The window must match one generated from the shop's
    operating hours; the end time, shop details and vehicle summary are
    filled in by the server.
    """

    mechanic_id: str = Field(..., min_length=1)
    appointment_date: date_type
    appointment_start_time: str = Field(
        ...,
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$",
        description="24-hour start time in HH:MM format, e.g. 08:30",
    )
    customer_id: str = Field(..., min_length=1)
    customer_name: str = Field(..., min_length=1, max_length=120)
    vehicle_id: str = Field(..., min_length=1)
    service_requested: str = Field(..., min_length=1, max_length=100)
    problem_description: str = Field(default="", max_length=1000)


class ServiceRequestStatusUpdate(BaseModel):
    """Mechanic action for a service request lifecycle update."""

    mechanic_id: str = Field(..., min_length=1)
    status: Literal["accepted", "declined", "completed"]
    completed_mileage: Optional[int] = Field(
        default=None,
        ge=0,
        description=(
            "Optional final odometer reading when marking an accepted request "
            "completed. If supplied, the owner's Garage vehicle is updated too."
        ),
    )
