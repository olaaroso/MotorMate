from typing import List, Optional

from pydantic import BaseModel, Field


class PartListing(BaseModel):
    """A DIY part listing exposed to neighborhood users."""

    listing_id: Optional[str] = None
    seller_name: str
    item_name: str
    category: str
    condition: str = "used"
    price: float = Field(..., gt=0)
    zip_code: str
    availability: str = "available"
    description: Optional[str] = None
    specialties: List[str] = Field(default_factory=list)
    rating: float = Field(default=5.0, ge=0, le=5)

    @property
    def is_available(self) -> bool:
        return self.availability.lower() == "available"
