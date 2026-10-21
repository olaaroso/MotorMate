from datetime import date, datetime, timezone

from typing import List, Optional



from bson import ObjectId

from fastapi import APIRouter, HTTPException

from pydantic import BaseModel, Field



from app.core.database import db_instance





router = APIRouter(

    prefix="/api/diy",

    tags=["DIY Marketplace"],

)





# =========================================================

# LISTING MODELS

# =========================================================





class DIYListingCreate(BaseModel):

    owner_id: str

    seller_name: str



    item_name: str

    category: str

    condition: str = "used"



    price: float = Field(..., gt=0)

    deposit: float = Field(default=0, ge=0)



    location: str

    zip_code: str = "11735"



    availability: str = "available"



    description: Optional[str] = None

    specifications: Optional[str] = None



    photo_urls: List[str] = Field(default_factory=list)



    distance: float = Field(default=2.5, ge=0.0)



    rating: float = 4.9

    reviews: int = 0





class DIYListingUpdate(BaseModel):

    item_name: Optional[str] = None

    category: Optional[str] = None

    condition: Optional[str] = None



    price: Optional[float] = Field(default=None, gt=0)

    deposit: Optional[float] = Field(default=None, ge=0)



    location: Optional[str] = None

    zip_code: Optional[str] = None



    availability: Optional[str] = None



    description: Optional[str] = None

    specifications: Optional[str] = None



    photo_urls: Optional[List[str]] = None





# =========================================================

# RENTAL REQUEST MODELS

# =========================================================





class RentalRequestCreate(BaseModel):

    listing_id: str



    renter_id: str

    renter_name: str



    start_date: date

    end_date: date





# =========================================================

# DEFAULT TOOL LISTINGS

# =========================================================





DEFAULT_SEED_LISTINGS = [

    {

        "owner_id": "seed-user-1",

        "seller_name": "Mike R.",

        "item_name": "3-Ton Floor Jack",

        "category": "Lifting",

        "condition": "Good",

        "price": 18.0,

        "deposit": 40.0,

        "distance": 1.2,

        "rating": 4.9,

        "reviews": 24,

        "location": "Farmingdale, NY",

        "zip_code": "11735",

        "availability": "available",

        "description": (

            "Heavy-duty floor jack suitable for most "

            "passenger vehicles."

        ),

        "specifications": "3-ton capacity",

        "photo_urls": [],

    },

    {

        "owner_id": "seed-user-2",

        "seller_name": "Alex T.",

        "item_name": "Cordless Impact Wrench",

        "category": "Power Tools",

        "condition": "Excellent",

        "price": 14.0,

        "deposit": 35.0,

        "distance": 2.4,

        "rating": 4.8,

        "reviews": 18,

        "location": "Farmingdale, NY",

        "zip_code": "11735",

        "availability": "available",

        "description": (

            "Cordless impact wrench with battery "

            "and charger."

        ),

        "specifications": "1/2-inch drive",

        "photo_urls": [],

    },

    {

        "owner_id": "seed-user-3",

        "seller_name": "Chris M.",

        "item_name": "OBD-II Diagnostic Scanner",

        "category": "Diagnostics",

        "condition": "Like New",

        "price": 12.0,

        "deposit": 25.0,

        "distance": 3.1,

        "rating": 5.0,

        "reviews": 31,

        "location": "Farmingdale, NY",

        "zip_code": "11735",

        "availability": "available",

        "description": (

            "OBD-II scanner for reading and clearing "

            "diagnostic trouble codes."

        ),

        "specifications": "Works with OBD-II vehicles",

        "photo_urls": [],

    },

]





# =========================================================

# DATABASE HELPERS

# =========================================================





def get_tools_collection():

    if db_instance.db is None:

        raise HTTPException(

            status_code=503,

            detail="Database is not connected.",

        )



    return db_instance.db["tool_listings"]





def get_rental_requests_collection():

    if db_instance.db is None:

        raise HTTPException(

            status_code=503,

            detail="Database is not connected.",

        )



    return db_instance.db["tool_rental_requests"]





def serialize_mongo_document(document: dict):

    document["id"] = str(document["_id"])

    document.pop("_id", None)



    return document



async def normalize_legacy_listing_availability(
    tools_collection,
):
    """
    Older versions of ToolDrop stored "rented" directly
    on the listing. Rental state is now derived from
    approved rental date ranges instead.
    """
    await tools_collection.update_many(
        {
            "availability": "rented",
        },
        {
            "$set": {
                "availability": "available",
            },
            "$unset": {
                "current_rental_request_id": "",
            },
        },
    )





# =========================================================

# PUBLIC TOOL LISTINGS

# =========================================================





@router.get("/listings")

async def list_listings(

    sort_by: str = "distance",

    order: str = "asc",

    category: Optional[str] = None,

    search: Optional[str] = None,

):

    tools_collection = get_tools_collection()



    try:

        await normalize_legacy_listing_availability(
            tools_collection
        )

        if await tools_collection.count_documents({}) == 0:

            await tools_collection.insert_many(

                [

                    dict(tool)

                    for tool in DEFAULT_SEED_LISTINGS

                ]

            )



        # Public ToolDrop should only display tools

        # that are currently available to rent.

        filter_query = {

            "availability": "available",

        }



        if category and category.lower() != "all":

            filter_query["category"] = {

                "$regex": f"^{category}$",

                "$options": "i",

            }



        if search:

            filter_query["item_name"] = {

                "$regex": search,

                "$options": "i",

            }



        allowed_sort_fields = {

            "price": "price",

            "distance": "distance",

            "rating": "rating",

        }



        field = allowed_sort_fields.get(

            sort_by,

            "distance",

        )



        sort_direction = (

            1

            if order == "asc"

            else -1

        )



        cursor = tools_collection.find(

            filter_query

        ).sort(

            field,

            sort_direction,

        )



        results = []



        async for tool in cursor:

            results.append(

                serialize_mongo_document(tool)

            )



        return {

            "results": results,

        }



    except HTTPException:

        raise



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to retrieve listings: "

                f"{str(exc)}"

            ),

        )





# =========================================================

# OWNER'S TOOL LISTINGS

# =========================================================





@router.get("/listings/owner/{owner_id}")

async def get_owner_listings(

    owner_id: str,

):

    owner_id = owner_id.strip()



    if not owner_id:

        raise HTTPException(

            status_code=400,

            detail="owner_id is required.",

        )



    tools_collection = get_tools_collection()



    try:

        await normalize_legacy_listing_availability(
            tools_collection
        )

        cursor = tools_collection.find(

            {

                "owner_id": owner_id,

            }

        )



        results = []



        async for tool in cursor:

            results.append(

                serialize_mongo_document(tool)

            )



        return {

            "count": len(results),

            "results": results,

        }



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to retrieve owner listings: "

                f"{str(exc)}"

            ),

        )





# =========================================================

# SINGLE PUBLIC TOOL LISTING

# =========================================================





@router.get("/listings/{listing_id}")

async def get_listing(

    listing_id: str,

):

    if not ObjectId.is_valid(listing_id):

        raise HTTPException(

            status_code=400,

            detail="Invalid listing ID.",

        )



    tools_collection = get_tools_collection()



    try:

        await normalize_legacy_listing_availability(
            tools_collection
        )

        tool = await tools_collection.find_one(

            {

                "_id": ObjectId(listing_id),

                "availability": "available",

            }

        )



        if not tool:

            raise HTTPException(

                status_code=404,

                detail=(

                    "Listing not found or is no "

                    "longer available."

                ),

            )



        rental_requests_collection = (
            get_rental_requests_collection()
        )

        reserved_ranges = []

        reservations_cursor = (
            rental_requests_collection.find(
                {
                    "listing_id": listing_id,
                    "status": {
                        "$in": [
                            "approved",
                            "active",
                        ]
                    },
                    "end_date": {
                        "$gte": date.today().isoformat(),
                    },
                }
            )
            .sort(
                "start_date",
                1,
            )
        )

        async for reservation in reservations_cursor:
            reserved_ranges.append(
                {
                    "request_id": str(
                        reservation["_id"]
                    ),
                    "start_date": reservation.get(
                        "start_date",
                        "",
                    ),
                    "end_date": reservation.get(
                        "end_date",
                        "",
                    ),
                }
            )

        return {

            "listing":
                serialize_mongo_document(tool),

            "reserved_ranges":
                reserved_ranges,

        }



    except HTTPException:

        raise



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to retrieve listing: "

                f"{str(exc)}"

            ),

        )





# =========================================================

# CREATE TOOL LISTING

# =========================================================





@router.post("/listings")

async def create_listing(

    payload: DIYListingCreate,

):

    tools_collection = get_tools_collection()



    if not payload.owner_id.strip():

        raise HTTPException(

            status_code=400,

            detail="owner_id is required.",

        )



    try:

        doc = payload.model_dump()



        result = await tools_collection.insert_one(

            doc

        )



        doc["id"] = str(

            result.inserted_id

        )



        doc.pop(

            "_id",

            None,

        )



        return {

            "message":

                "Listing created successfully.",

            "listing": doc,

        }



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to create listing: "

                f"{str(exc)}"

            ),

        )





# =========================================================

# UPDATE TOOL LISTING

# =========================================================





@router.put("/listings/{listing_id}")

async def update_listing(

    listing_id: str,

    owner_id: str,

    payload: DIYListingUpdate,

):

    if not ObjectId.is_valid(listing_id):

        raise HTTPException(

            status_code=400,

            detail="Invalid listing ID.",

        )



    if not owner_id.strip():

        raise HTTPException(

            status_code=400,

            detail="owner_id is required.",

        )



    tools_collection = get_tools_collection()



    updates = payload.model_dump(

        exclude_none=True

    )



    if not updates:

        raise HTTPException(

            status_code=400,

            detail=(

                "No listing changes were provided."

            ),

        )



    try:

        result = (

            await tools_collection.update_one(

                {

                    "_id":

                        ObjectId(listing_id),

                    "owner_id":

                        owner_id,

                },

                {

                    "$set": updates,

                },

            )

        )



        if result.matched_count == 0:

            raise HTTPException(

                status_code=404,

                detail=(

                    "Listing not found or you do "

                    "not own this listing."

                ),

            )



        updated_listing = (

            await tools_collection.find_one(

                {

                    "_id":

                        ObjectId(listing_id),

                    "owner_id":

                        owner_id,

                }

            )

        )



        return {

            "message":

                "Listing updated successfully.",

            "listing":

                serialize_mongo_document(

                    updated_listing

                ),

        }



    except HTTPException:

        raise



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to update listing: "

                f"{str(exc)}"

            ),

        )





# =========================================================

# DELETE TOOL LISTING

# =========================================================





@router.delete("/listings/{listing_id}")

async def delete_listing(

    listing_id: str,

    owner_id: str,

):

    if not ObjectId.is_valid(listing_id):

        raise HTTPException(

            status_code=400,

            detail="Invalid listing ID.",

        )



    if not owner_id.strip():

        raise HTTPException(

            status_code=400,

            detail="owner_id is required.",

        )



    tools_collection = get_tools_collection()



    try:

        result = (

            await tools_collection.delete_one(

                {

                    "_id":

                        ObjectId(listing_id),

                    "owner_id":

                        owner_id,

                }

            )

        )



        if result.deleted_count == 0:

            raise HTTPException(

                status_code=404,

                detail=(

                    "Listing not found or you do "

                    "not own this listing."

                ),

            )



        return {

            "message":

                "Listing deleted successfully.",

            "listing_id":

                listing_id,

        }



    except HTTPException:

        raise



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to delete listing: "

                f"{str(exc)}"

            ),

        )





# =========================================================

# CREATE RENTAL REQUEST

# =========================================================





@router.post("/rental-requests")

async def create_rental_request(

    payload: RentalRequestCreate,

):

    """

    Creates a pending request to rent a tool.



    The backend looks up the listing itself so

    owner_id cannot simply be supplied or changed

    by the renter.

    """



    tools_collection = get_tools_collection()



    rental_requests_collection = (

        get_rental_requests_collection()

    )



    if not ObjectId.is_valid(

        payload.listing_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid listing ID.",

        )



    renter_id = (

        payload.renter_id.strip()

    )



    renter_name = (

        payload.renter_name.strip()

    )



    if not renter_id:

        raise HTTPException(

            status_code=400,

            detail="renter_id is required.",

        )



    if not renter_name:

        raise HTTPException(

            status_code=400,

            detail="renter_name is required.",

        )



    if payload.start_date < date.today():

        raise HTTPException(

            status_code=400,

            detail=(

                "Rental start date cannot "

                "be in the past."

            ),

        )



    if payload.end_date < payload.start_date:

        raise HTTPException(

            status_code=400,

            detail=(

                "Rental end date cannot be "

                "before the start date."

            ),

        )



    try:

        listing = (

            await tools_collection.find_one(

                {

                    "_id": ObjectId(

                        payload.listing_id

                    ),

                }

            )

        )



        if not listing:

            raise HTTPException(

                status_code=404,

                detail="Tool listing not found.",

            )



        if listing.get("availability") == "unavailable":

            raise HTTPException(

                status_code=409,

                detail=(

                    "This tool is currently disabled "

                    "by its owner."

                ),

            )



        owner_id = str(

            listing.get(

                "owner_id",

                "",

            )

        ).strip()



        if not owner_id:

            raise HTTPException(

                status_code=400,

                detail=(

                    "This listing does not have "

                    "a valid owner."

                ),

            )



        # IMPORTANT:

        # A user can never rent their own tool.

        if owner_id == renter_id:

            raise HTTPException(

                status_code=403,

                detail=(

                    "You cannot request to rent "

                    "your own tool."

                ),

            )



        requested_start = payload.start_date.isoformat()
        requested_end = payload.end_date.isoformat()

        # If these dates already overlap an approved/active
        # rental, the dates are not available.
        approved_conflict = (
            await rental_requests_collection.find_one(
                {
                    "listing_id": payload.listing_id,
                    "status": {
                        "$in": [
                            "approved",
                            "active",
                        ]
                    },
                    "start_date": {
                        "$lte": requested_end,
                    },
                    "end_date": {
                        "$gte": requested_start,
                    },
                }
            )
        )

        if approved_conflict:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Those rental dates are already "
                    "reserved for this tool."
                ),
            )

        # Prevent this renter from sending another
        # request that overlaps one of their own
        # pending/approved requests for this tool.
        existing_request = (
            await rental_requests_collection.find_one(
                {
                    "listing_id": payload.listing_id,
                    "renter_id": renter_id,
                    "status": {
                        "$in": [
                            "pending",
                            "approved",
                            "active",
                        ]
                    },
                    "start_date": {
                        "$lte": requested_end,
                    },
                    "end_date": {
                        "$gte": requested_start,
                    },
                }
            )
        )

        if existing_request:
            raise HTTPException(
                status_code=409,
                detail=(
                    "You already have a request for "
                    "this tool that overlaps those dates."
                ),
            )


        total_days = (

            payload.end_date

            - payload.start_date

        ).days + 1



        daily_rate = float(

            listing.get(

                "price",

                0,

            )

        )



        deposit = float(

            listing.get(

                "deposit",

                0,

            )

        )



        rental_price = round(

            daily_rate * total_days,

            2,

        )



        total_with_deposit = round(

            rental_price + deposit,

            2,

        )



        request_document = {

            "listing_id":

                payload.listing_id,



            "owner_id":

                owner_id,



            "renter_id":

                renter_id,



            "renter_name":

                renter_name,



            "seller_name":

                listing.get(

                    "seller_name",

                    "MotorMate User",

                ),



            "tool_name":

                listing.get(

                    "item_name",

                    "Tool",

                ),



            "photo_urls":

                listing.get(

                    "photo_urls",

                    [],

                ),



            "location":

                listing.get(

                    "location",

                    "",

                ),



            "start_date":

                payload.start_date.isoformat(),



            "end_date":

                payload.end_date.isoformat(),



            "daily_rate":

                daily_rate,



            "deposit":

                deposit,



            "rental_days":

                total_days,



            "rental_price":

                rental_price,



            "total_with_deposit":

                total_with_deposit,



            "status":

                "pending",



            "created_at":

                datetime.now(

                    timezone.utc

                ).isoformat(),

        }



        result = (

            await rental_requests_collection.insert_one(

                request_document

            )

        )



        request_document["id"] = str(

            result.inserted_id

        )



        request_document.pop(

            "_id",

            None,

        )



        return {

            "message":

                "Rental request submitted successfully.",

            "request":

                request_document,

        }



    except HTTPException:

        raise



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to create rental request: "

                f"{str(exc)}"

            ),

        )





# =========================================================

# GET RENTAL REQUESTS FOR A BORROWER

# =========================================================





@router.get(

    "/rental-requests/renter/{renter_id}"

)

async def get_renter_rental_requests(

    renter_id: str,

):

    renter_id = renter_id.strip()



    if not renter_id:

        raise HTTPException(

            status_code=400,

            detail="renter_id is required.",

        )



    rental_requests_collection = (

        get_rental_requests_collection()

    )



    try:

        cursor = (

            rental_requests_collection

            .find(

                {

                    "renter_id":

                        renter_id,

                }

            )

            .sort(

                "created_at",

                -1,

            )

        )



        results = []



        async for request in cursor:

            results.append(

                serialize_mongo_document(

                    request

                )

            )



        return {

            "count": len(results),

            "results": results,

        }



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to retrieve rental "

                f"requests: {str(exc)}"

            ),

        )





# =========================================================

# GET RENTAL REQUESTS FOR A TOOL OWNER

# =========================================================





@router.get(

    "/rental-requests/owner/{owner_id}"

)

async def get_owner_rental_requests(

    owner_id: str,

):

    owner_id = owner_id.strip()



    if not owner_id:

        raise HTTPException(

            status_code=400,

            detail="owner_id is required.",

        )



    rental_requests_collection = (

        get_rental_requests_collection()

    )



    try:

        cursor = (

            rental_requests_collection

            .find(

                {

                    "owner_id":

                        owner_id,

                }

            )

            .sort(

                "created_at",

                -1,

            )

        )



        results = []



        async for request in cursor:

            results.append(

                serialize_mongo_document(

                    request

                )

            )



        return {

            "count": len(results),

            "results": results,

        }



    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to retrieve owner rental "

                f"requests: {str(exc)}"

            ),

        )

# =========================================================
# APPROVE RENTAL REQUEST
# =========================================================


@router.patch("/rental-requests/{request_id}/approve")
async def approve_rental_request(
    request_id: str,
    owner_id: str,
):
    if not ObjectId.is_valid(request_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid rental request ID.",
        )

    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    tools_collection = get_tools_collection()
    rental_requests_collection = (
        get_rental_requests_collection()
    )

    try:
        rental_request = (
            await rental_requests_collection.find_one(
                {
                    "_id": ObjectId(request_id),
                    "owner_id": owner_id,
                }
            )
        )

        if not rental_request:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Rental request not found or "
                    "you do not own this listing."
                ),
            )

        if rental_request.get("status") != "pending":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Only pending rental requests "
                    "can be approved."
                ),
            )

        listing_id = str(
            rental_request.get(
                "listing_id",
                "",
            )
        ).strip()

        if not ObjectId.is_valid(listing_id):
            raise HTTPException(
                status_code=400,
                detail=(
                    "The rental request has an "
                    "invalid listing ID."
                ),
            )

        listing = await tools_collection.find_one(
            {
                "_id": ObjectId(listing_id),
                "owner_id": owner_id,
            }
        )

        if not listing:
            raise HTTPException(
                status_code=404,
                detail=(
                    "The tool listing was not found "
                    "or you do not own it."
                ),
            )

        if listing.get("availability") == "unavailable":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Make the tool available before "
                    "approving a rental request."
                ),
            )

        approved_start_date = str(
            rental_request.get(
                "start_date",
                "",
            )
        )

        approved_end_date = str(
            rental_request.get(
                "end_date",
                "",
            )
        )

        # A tool can have multiple approved rentals as long
        # as their date ranges do not overlap.
        approved_conflict = (
            await rental_requests_collection.find_one(
                {
                    "listing_id": listing_id,
                    "_id": {
                        "$ne": ObjectId(request_id),
                    },
                    "status": {
                        "$in": [
                            "approved",
                            "active",
                        ]
                    },
                    "start_date": {
                        "$lte": approved_end_date,
                    },
                    "end_date": {
                        "$gte": approved_start_date,
                    },
                }
            )
        )

        if approved_conflict:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Those dates overlap an already "
                    "approved rental for this tool."
                ),
            )

        approved_at = datetime.now(
            timezone.utc
        ).isoformat()

        await rental_requests_collection.update_one(
            {
                "_id": ObjectId(request_id),
                "owner_id": owner_id,
                "status": "pending",
            },
            {
                "$set": {
                    "status": "approved",
                    "approved_at": approved_at,
                }
            },
        )

        # Reject only pending requests that overlap the
        # newly approved reservation. Non-overlapping
        # requests remain pending and can still be approved.
        await rental_requests_collection.update_many(
            {
                "listing_id": listing_id,
                "_id": {
                    "$ne": ObjectId(request_id),
                },
                "status": "pending",
                "start_date": {
                    "$lte": approved_end_date,
                },
                "end_date": {
                    "$gte": approved_start_date,
                },
            },
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": approved_at,
                    "rejection_reason": (
                        "This request overlaps dates "
                        "that were approved for "
                        "another renter."
                    ),
                }
            },
        )

        # "rented" is no longer stored as a permanent
        # listing state. Current/upcoming rental state is
        # derived from approved reservation dates.
        if listing.get("availability") == "rented":
            await tools_collection.update_one(
                {
                    "_id": ObjectId(listing_id),
                    "owner_id": owner_id,
                },
                {
                    "$set": {
                        "availability": "available",
                    },
                    "$unset": {
                        "current_rental_request_id": "",
                    },
                },
            )

        updated_request = (
            await rental_requests_collection.find_one(
                {
                    "_id": ObjectId(request_id),
                }
            )
        )

        renter_id = updated_request.get("renter_id")
        tool_name = updated_request.get("tool_name", "Tool")

        notification_doc = {
            "user_id": renter_id,
            "title": "Rental Approved! 🎉",
            "message": f"Your rental reservation for the {tool_name} has been approved by the owner.",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db_instance.db["notifications"].insert_one(notification_doc)

        return {
            "message": "Rental request approved successfully.",
            "request": serialize_mongo_document(updated_request),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to approve rental request: "
                f"{str(exc)}"
            ),
        )


# =========================================================
# CANCEL APPROVED RENTAL
# =========================================================


@router.patch("/rental-requests/{request_id}/cancel")
async def cancel_rental(
    request_id: str,
    owner_id: str,
):
    if not ObjectId.is_valid(request_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid rental request ID.",
        )

    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    rental_requests_collection = (
        get_rental_requests_collection()
    )

    try:
        rental_request = (
            await rental_requests_collection.find_one(
                {
                    "_id": ObjectId(request_id),
                    "owner_id": owner_id,
                }
            )
        )

        if not rental_request:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Rental not found or you do "
                    "not own this listing."
                ),
            )

        if rental_request.get("status") not in [
            "approved",
            "active",
        ]:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Only an approved or active rental "
                    "can be cancelled."
                ),
            )

        end_date = str(
            rental_request.get(
                "end_date",
                "",
            )
        )

        if not end_date:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This rental does not have "
                    "a valid end date."
                ),
            )

        if end_date < date.today().isoformat():
            raise HTTPException(
                status_code=409,
                detail=(
                    "This rental has already ended and "
                    "can no longer be cancelled."
                ),
            )

        cancelled_at = datetime.now(
            timezone.utc
        ).isoformat()

        await rental_requests_collection.update_one(
            {
                "_id": ObjectId(request_id),
                "owner_id": owner_id,
                "status": {
                    "$in": [
                        "approved",
                        "active",
                    ]
                },
            },
            {
                "$set": {
                    "status": "cancelled",
                    "cancelled_at": cancelled_at,
                    "cancellation_reason":
                        "Cancelled by tool owner.",
                }
            },
        )

        updated_request = (
            await rental_requests_collection.find_one(
                {
                    "_id": ObjectId(request_id),
                }
            )
        )

        # ---------------------------------------------------------
        # 2. ADD THIS NEW NOTIFICATION LOGIC
        # ---------------------------------------------------------
        renter_id = updated_request.get("renter_id")
        tool_name = updated_request.get("tool_name", "Tool")

        new_notification = Notification(
            id=str(uuid.uuid4()),
            user_id=renter_id,
            title="Rental Declined",
            message=f"Unfortunately, your upcoming rental for the {tool_name} was cancelled by the owner.",
            is_read=False
        )
        db.add(new_notification)
        db.commit()
        # ---------------------------------------------------------

        return {
            "message": "Rental cancelled successfully.",
            "request": serialize_mongo_document(updated_request),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to cancel rental: "
                f"{str(exc)}"
            ),
        )


# =========================================================
# REJECT RENTAL REQUEST
# =========================================================


@router.patch("/rental-requests/{request_id}/reject")
async def reject_rental_request(
    request_id: str,
    owner_id: str,
):
    if not ObjectId.is_valid(request_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid rental request ID.",
        )

    owner_id = owner_id.strip()

    if not owner_id:
        raise HTTPException(
            status_code=400,
            detail="owner_id is required.",
        )

    rental_requests_collection = (
        get_rental_requests_collection()
    )

    try:
        rental_request = (
            await rental_requests_collection.find_one(
                {
                    "_id": ObjectId(request_id),
                    "owner_id": owner_id,
                }
            )
        )

        if not rental_request:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Rental request not found or "
                    "you do not own this listing."
                ),
            )

        if rental_request.get("status") != "pending":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Only pending rental requests "
                    "can be rejected."
                ),
            )

        rejected_at = datetime.now(
            timezone.utc
        ).isoformat()

        await rental_requests_collection.update_one(
            {
                "_id": ObjectId(request_id),
                "owner_id": owner_id,
                "status": "pending",
            },
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": rejected_at,
                }
            },
        )

        updated_request = (
            await rental_requests_collection.find_one(
                {
                    "_id": ObjectId(request_id),
                }
            )
        )

        renter_id = updated_request.get("renter_id")
        tool_name = updated_request.get("tool_name", "Tool")

        notification_doc = {
            "user_id": renter_id,
            "title": "Rental Declined",
            "message": f"Unfortunately, your rental request for the {tool_name} was declined by the owner.",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db_instance.db["notifications"].insert_one(notification_doc)

        return {
            "message": "Rental request rejected successfully.",
            "request": serialize_mongo_document(updated_request),
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to reject rental request: "
                f"{str(exc)}"
            ),
        )

