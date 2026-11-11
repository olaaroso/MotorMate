from typing import Literal

from pydantic import BaseModel, Field

MessagingView = Literal["mechanic", "customer"]

MAX_MESSAGE_LENGTH = 1000


class ServiceRequestMessageCreate(BaseModel):
    """
    A plain-text message from one participant of a service request to the
    other. The recipient is always derived from the request on the server.
    """

    actor_id: str = Field(..., min_length=1)
    view: MessagingView
    body: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LENGTH)
