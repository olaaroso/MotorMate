import asyncio
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.api import routes_service_requests as routes
from app.models.appointment import ServiceRequestCreate
from app.services import notifications as notification_service
from app.tests.fake_mongo import FakeCollection

APPOINTMENT_DATE = date.today() + timedelta(days=7)
VEHICLE_ID = ObjectId()
OTHER_VEHICLE_ID = ObjectId()
ALL_WEEK = {
    day: "8:00 AM - 5:00 PM"
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
}


def history_record(vehicle_id, owner_id, title, service_date):
    return {
        "_id": ObjectId(),
        "vehicle_id": str(vehicle_id),
        "owner_id": owner_id,
        "record_type": "maintenance",
        "title": title,
        "service_date": service_date,
        "mileage": 42000,
        "cost": 59.99,
        "provider": "Quick Lube",
        "part_name": None,
        "notes": "Synthetic oil",
        "source_service_request_id": "abc123",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }


@pytest.fixture
def db(monkeypatch):
    database = {
        "mechanics": FakeCollection([
            {
                "_id": ObjectId(),
                "owner_id": "mechanic-1",
                "shop_name": "Northside Auto",
                "services_offered": ["Oil Change"],
                "operating_hours": ALL_WEEK,
            }
        ]),
        "vehicles": FakeCollection([
            {"_id": VEHICLE_ID, "owner_id": "customer-1", "year": 2018, "make": "Honda", "model": "Civic"}
        ]),
        "service_requests": FakeCollection(),
        "notifications": FakeCollection(),
        "service_history": FakeCollection([
            history_record(VEHICLE_ID, "customer-1", "Oil Change", "2026-03-01"),
            history_record(OTHER_VEHICLE_ID, "customer-1", "Other car service", "2026-04-01"),
            history_record(VEHICLE_ID, "someone-else", "Not this owner", "2026-05-01"),
        ]),
    }
    handle = SimpleNamespace(db=database)
    monkeypatch.setattr(routes, "db_instance", handle)
    monkeypatch.setattr(notification_service, "db_instance", handle)
    monkeypatch.setattr(routes, "_indexes_ready", True)
    return database


def stored_request(db, status="pending", **extra):
    document = {
        "_id": ObjectId(),
        "customer_id": "customer-1",
        "customer_name": "Customer One",
        "mechanic_id": "mechanic-1",
        "vehicle_id": str(VEHICLE_ID),
        "vehicle_summary": {"year": 2018, "make": "Honda", "model": "Civic"},
        "appointment_date": APPOINTMENT_DATE.isoformat(),
        "appointment_start_time": "09:00",
        "appointment_end_time": "09:30",
        "service_requested": "Oil Change",
        "status": status,
        **extra,
    }
    db["service_requests"].documents.append(document)
    return str(document["_id"])


def shared_history(request_id, mechanic_id="mechanic-1"):
    return asyncio.run(routes.get_shared_service_history(request_id, mechanic_id))


def blocked(request_id, mechanic_id="mechanic-1"):
    with pytest.raises(HTTPException) as error:
        shared_history(request_id, mechanic_id)
    return error.value


@pytest.mark.parametrize("status", ["pending", "accepted", "completed"])
def test_shared_history_allowed_for_active_and_completed_requests(db, status):
    request_id = stored_request(db, status=status, share_service_history=True)

    result = shared_history(request_id)

    assert result["total"] == 1
    assert result["records"] == [
        {
            "record_type": "maintenance",
            "title": "Oil Change",
            "service_date": "2026-03-01",
            "mileage": 42000,
            "cost": 59.99,
            "provider": "Quick Lube",
            "part_name": None,
            "notes": "Synthetic oil",
        }
    ]


def test_shared_history_hides_internal_ids(db):
    request_id = stored_request(db, share_service_history=True)

    record = shared_history(request_id)["records"][0]

    for field in ("_id", "owner_id", "vehicle_id", "source_service_request_id"):
        assert field not in record


def test_sharing_disabled_is_blocked(db):
    request_id = stored_request(db, share_service_history=False)

    error = blocked(request_id)

    assert error.status_code == 403
    assert "chose not to share" in error.detail


def test_older_request_without_flag_is_treated_as_not_shared(db):
    request_id = stored_request(db)

    assert blocked(request_id).status_code == 403


def test_different_mechanic_is_blocked(db):
    request_id = stored_request(db, share_service_history=True)

    assert blocked(request_id, mechanic_id="mechanic-2").status_code == 404


def test_declined_request_is_blocked(db):
    request_id = stored_request(db, status="declined", share_service_history=True)

    error = blocked(request_id)

    assert error.status_code == 403
    assert "pending, accepted, or completed" in error.detail


def test_invalid_request_id_is_rejected(db):
    assert blocked("not-an-id").status_code == 400


def submit(db, share=None):
    payload = {
        "mechanic_id": "mechanic-1",
        "appointment_date": APPOINTMENT_DATE,
        "appointment_start_time": "10:00",
        "customer_id": "customer-1",
        "customer_name": "Customer One",
        "vehicle_id": str(VEHICLE_ID),
        "service_requested": "Oil Change",
    }
    if share is not None:
        payload["share_service_history"] = share
    return asyncio.run(routes.create_service_request(ServiceRequestCreate(**payload)))


@pytest.mark.parametrize(("share", "stored"), [(True, True), (False, False), (None, False)])
def test_customer_can_submit_with_sharing_on_or_off(db, share, stored):
    result = submit(db, share)

    assert result["request"]["status"] == "pending"
    assert result["request"]["share_service_history"] is stored
    assert db["service_requests"].documents[-1]["share_service_history"] is stored


def test_mechanic_list_omits_customer_and_vehicle_ids(db):
    stored_request(db, share_service_history=True)
    stored_request(db)

    results = asyncio.run(routes.get_mechanic_service_requests("mechanic-1", None))["results"]

    for item in results:
        assert "customer_id" not in item
        assert "vehicle_id" not in item
        assert item["vehicle_summary"]["make"] == "Honda"
    assert [item["share_service_history"] for item in results] == [True, False]
