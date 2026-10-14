from datetime import date, datetime, timezone
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.database import db_instance

router = APIRouter(
    prefix="/api/service-history",
    tags=["Service History"],
)


def get_database():

    database = getattr(db_instance, "database", None)

    if database is None:
        database = getattr(db_instance, "db", None)

    if database is None:
        raise HTTPException(
            status_code=503,
            detail="Database is not initialized.",
        )

    return database


def service_history_collection():
    return get_database()["service_history"]


def vehicles_collection():
    return get_database()["vehicles"]


def parse_object_id(value: str, name: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {name}.",
        )


async def verify_vehicle_owner(vehicle_id: str, owner_id: str):
    vehicle_object_id = parse_object_id(vehicle_id, "vehicle id")

    vehicle = await vehicles_collection().find_one(
        {
            "_id": vehicle_object_id,
            "owner_id": owner_id,
        }
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found for this user.",
        )

    return vehicle


def serialize_record(record: dict) -> dict:
    record = dict(record)

    if "_id" in record:
        record["_id"] = str(record["_id"])

    return record


def model_to_dict(model, *, exclude_none: bool = False):

    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_none=exclude_none)

    return model.dict(exclude_none=exclude_none)


class ServiceRecordCreate(BaseModel):
    vehicle_id: str
    owner_id: str

    record_type: Literal[
        "maintenance",
        "part_replacement",
    ] = "maintenance"

    title: str = Field(..., min_length=1, max_length=120)
    service_date: date
    mileage: int = Field(..., ge=0)

    cost: Optional[float] = Field(default=None, ge=0)
    provider: Optional[str] = Field(default=None, max_length=120)
    part_name: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=1000)


class ServiceRecordUpdate(BaseModel):
    owner_id: str

    record_type: Optional[
        Literal["maintenance", "part_replacement"]
    ] = None

    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    service_date: Optional[date] = None
    mileage: Optional[int] = Field(default=None, ge=0)

    cost: Optional[float] = Field(default=None, ge=0)
    provider: Optional[str] = Field(default=None, max_length=120)
    part_name: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=1000)


@router.post("/")
async def create_service_record(payload: ServiceRecordCreate):
    await verify_vehicle_owner(
        payload.vehicle_id,
        payload.owner_id,
    )

    now = datetime.now(timezone.utc).isoformat()

    document = {
        "vehicle_id": payload.vehicle_id,
        "owner_id": payload.owner_id,

        "record_type": payload.record_type,
        "title": payload.title.strip(),
        "service_date": payload.service_date.isoformat(),
        "mileage": payload.mileage,

        "cost": payload.cost,
        "provider": (
            payload.provider.strip()
            if payload.provider
            else None
        ),
        "part_name": (
            payload.part_name.strip()
            if payload.part_name
            else None
        ),
        "notes": (
            payload.notes.strip()
            if payload.notes
            else None
        ),

        "created_at": now,
        "updated_at": now,
    }

    result = await service_history_collection().insert_one(document)

    document["_id"] = str(result.inserted_id)

    return {
        "message": "Service record created successfully.",
        "service_record": document,
    }

@router.get("/vehicle/{vehicle_id}")
async def get_vehicle_service_history(
    vehicle_id: str,
    owner_id: str,
):
    await verify_vehicle_owner(vehicle_id, owner_id)

    cursor = (
        service_history_collection()
        .find(
            {
                "vehicle_id": vehicle_id,
                "owner_id": owner_id,
            }
        )
        .sort(
            [
                ("service_date", -1),
                ("created_at", -1),
            ]
        )
    )

    records = []

    async for record in cursor:
        records.append(serialize_record(record))

    return {
        "vehicle_id": vehicle_id,
        "records": records,
        "total": len(records),
    }

@router.patch("/{record_id}")
async def update_service_record(
    record_id: str,
    payload: ServiceRecordUpdate,
):
    record_object_id = parse_object_id(
        record_id,
        "service record id",
    )

    existing = await service_history_collection().find_one(
        {
            "_id": record_object_id,
            "owner_id": payload.owner_id,
        }
    )

    if existing is None:
        raise HTTPException(
            status_code=404,
            detail="Service record not found.",
        )

    updates = model_to_dict(
        payload,
        exclude_none=True,
    )

    updates.pop("owner_id", None)

    if "service_date" in updates:
        updates["service_date"] = updates[
            "service_date"
        ].isoformat()

    if "title" in updates:
        updates["title"] = updates["title"].strip()

    for field_name in (
        "provider",
        "part_name",
        "notes",
    ):
        if field_name in updates and updates[field_name]:
            updates[field_name] = updates[field_name].strip()

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No changes were provided.",
        )

    updates["updated_at"] = datetime.now(
        timezone.utc
    ).isoformat()

    await service_history_collection().update_one(
        {
            "_id": record_object_id,
            "owner_id": payload.owner_id,
        },
        {
            "$set": updates,
        },
    )

    updated_record = (
        await service_history_collection().find_one(
            {
                "_id": record_object_id,
                "owner_id": payload.owner_id,
            }
        )
    )

    return {
        "message": "Service record updated successfully.",
        "service_record": serialize_record(
            updated_record
        ),
    }


@router.delete("/{record_id}")
async def delete_service_record(
    record_id: str,
    owner_id: str,
):
    record_object_id = parse_object_id(
        record_id,
        "service record id",
    )

    result = await service_history_collection().delete_one(
        {
            "_id": record_object_id,
            "owner_id": owner_id,
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Service record not found.",
        )

    return {
        "message": "Service record deleted successfully.",
    }