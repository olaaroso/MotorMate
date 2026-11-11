from datetime import date as date_type
from typing import Literal, Optional

from pydantic import BaseModel, Field

ServiceRequestStatus = Literal[
    "pending",
    "accepted",
    "declined",
    "completed",
    "cancelled",
]

MAX_CANCEL_REASON_LENGTH = 500


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
    share_service_history: bool = Field(
        default=False,
        description=(
            "Lets the mechanic view this vehicle's Garage service history "
            "while the request is pending, accepted, or completed."
        ),
    )


class ServiceRequestCancel(BaseModel):
    """
    A participant calling off a request. Who cancelled is derived from which
    side of the request actor_id matches, never supplied by the client.
    """

    actor_id: str = Field(..., min_length=1)
    view: Literal["mechanic", "customer"]
    reason: Optional[str] = Field(default=None, max_length=MAX_CANCEL_REASON_LENGTH)


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
    completed_cost: Optional[float] = Field(
        default=None,
        ge=0,
        description="Optional final service price recorded by the mechanic.",
    )
    completion_notes: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Optional mechanic notes saved with the completed service.",
    )
