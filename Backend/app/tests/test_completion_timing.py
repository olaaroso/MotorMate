import asyncio
from datetime import datetime
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.api import routes_service_requests as routes
from app.models.appointment import ServiceRequestStatusUpdate
from app.services import notifications as notification_service
from app.tests.fake_mongo import FakeCollection

VEHICLE_ID = ObjectId()


@pytest.fixture
def db(monkeypatch):
    database = {
        "mechanics": FakeCollection([{"_id": ObjectId(), "owner_id": "mechanic-1"}]),
        "vehicles": FakeCollection([
            {"_id": VEHICLE_ID, "owner_id": "customer-1", "current_mileage": 50000}
        ]),
        "service_requests": FakeCollection([
            {
                "_id": ObjectId(),
                "customer_id": "customer-1",
                "customer_name": "Customer One",
                "mechanic_id": "mechanic-1",
                "shop_name": "Northside Auto",
                "vehicle_id": str(VEHICLE_ID),
                "vehicle_summary": {"year": 2018, "make": "Honda", "model": "Civic"},
                "appointment_date": "2026-11-11",
                "appointment_start_time": "11:00",
                "appointment_end_time": "12:30",
                "service_requested": "Oil Change",
                "status": "accepted",
            }
        ]),
        "notifications": FakeCollection(),
        "service_history": FakeCollection(),
    }
    handle = SimpleNamespace(db=database)
    monkeypatch.setattr(routes, "db_instance", handle)
    monkeypatch.setattr(notification_service, "db_instance", handle)
    monkeypatch.setattr(routes, "_indexes_ready", True)
    return database


def complete_at(db, monkeypatch, now):
    monkeypatch.setattr(routes, "local_now", lambda: now)
    request_id = str(db["service_requests"].documents[0]["_id"])
    return asyncio.run(
        routes.update_service_request_status(
            request_id,
            ServiceRequestStatusUpdate(
                mechanic_id="mechanic-1", status="completed", completed_mileage=51000
            ),
        )
    )


@pytest.mark.parametrize(
    "now",
    [
        datetime(2026, 11, 8, 22, 0),
        datetime(2026, 11, 11, 11, 45),
        datetime(2026, 11, 11, 12, 29, 59),
    ],
    ids=["future-day", "in-progress", "one-second-early"],
)
def test_completion_before_end_time_is_rejected_without_side_effects(db, monkeypatch, now):
    with pytest.raises(HTTPException) as error:
        complete_at(db, monkeypatch, now)

    assert error.value.status_code == 409
    assert "Wed, Nov 11 at 12:30 PM" in error.value.detail
    assert db["service_requests"].documents[0]["status"] == "accepted"
    assert "completed_at" not in db["service_requests"].documents[0]
    assert db["service_history"].documents == []
    assert db["notifications"].documents == []
    assert db["vehicles"].documents[0]["current_mileage"] == 50000


@pytest.mark.parametrize(
    "now",
    [datetime(2026, 11, 11, 12, 30), datetime(2026, 11, 12, 9, 0)],
    ids=["ends-exactly-now", "already-ended"],
)
def test_completion_after_end_time_is_allowed(db, monkeypatch, now):
    result = complete_at(db, monkeypatch, now)

    assert result["request"]["status"] == "completed"
    assert len(db["service_history"].documents) == 1
    [alert] = db["notifications"].documents
    assert alert["title"] == "Service Completed"
    assert db["vehicles"].documents[0]["current_mileage"] == 51000


def test_legacy_request_without_end_time_uses_30_minute_default(db, monkeypatch):
    db["service_requests"].documents[0].pop("appointment_end_time")

    with pytest.raises(HTTPException):
        complete_at(db, monkeypatch, datetime(2026, 11, 11, 11, 29))

    assert complete_at(db, monkeypatch, datetime(2026, 11, 11, 11, 30))["request"]["status"] == "completed"
