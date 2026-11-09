import asyncio
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from bson import ObjectId

from app.api import routes_service_requests as routes
from app.models.appointment import ServiceRequestCreate, ServiceRequestStatusUpdate
from app.services import notifications as notification_service
from app.tests.fake_mongo import BrokenCollection, FakeCollection

ALL_WEEK = {
    day: "8:00 AM - 5:00 PM"
    for day in (
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    )
}
APPOINTMENT_DATE = date.today() + timedelta(days=7)


@pytest.fixture
def db(monkeypatch):
    vehicle_id = ObjectId()
    database = {
        "mechanics": FakeCollection([
            {
                "_id": ObjectId(),
                "owner_id": "mechanic-1",
                "shop_name": "Northside Auto",
                "services_offered": ["Oil Change", "Brake Pad Replacement"],
                "operating_hours": ALL_WEEK,
            }
        ]),
        "vehicles": FakeCollection([
            {
                "_id": vehicle_id,
                "owner_id": "customer-1",
                "year": 2018,
                "make": "Honda",
                "model": "Civic",
                "current_mileage": 50000,
            }
        ]),
        "service_requests": FakeCollection(),
        "notifications": FakeCollection(),
        "service_history": FakeCollection(),
    }
    database_handle = SimpleNamespace(db=database)
    monkeypatch.setattr(routes, "db_instance", database_handle)
    monkeypatch.setattr(notification_service, "db_instance", database_handle)
    monkeypatch.setattr(routes, "_indexes_ready", True)
    database["vehicle_id"] = str(vehicle_id)
    return database


def pending_request(customer_id, start_time="09:00", **extra):
    return {
        "_id": ObjectId(),
        "customer_id": customer_id,
        "customer_name": customer_id.title(),
        "mechanic_id": "mechanic-1",
        "shop_name": "Northside Auto",
        "vehicle_id": str(ObjectId()),
        "vehicle_summary": {"year": 2018, "make": "Honda", "model": "Civic"},
        "appointment_date": APPOINTMENT_DATE.isoformat(),
        "appointment_start_time": start_time,
        "appointment_end_time": "09:30",
        "service_requested": "Oil Change",
        "status": "pending",
        **extra,
    }


def notifications_for(db, user_id):
    return [doc for doc in db["notifications"].documents if doc["user_id"] == user_id]


def update_status(request_id, status, **extra):
    return asyncio.run(
        routes.update_service_request_status(
            str(request_id),
            ServiceRequestStatusUpdate(mechanic_id="mechanic-1", status=status, **extra),
        )
    )


def submit_request(db):
    return asyncio.run(
        routes.create_service_request(
            ServiceRequestCreate(
                mechanic_id="mechanic-1",
                appointment_date=APPOINTMENT_DATE,
                appointment_start_time="09:00",
                customer_id="customer-1",
                customer_name="Jason Martinez",
                vehicle_id=db["vehicle_id"],
                service_requested="Oil Change",
            )
        )
    )


def test_new_request_notifies_mechanic(db):
    submit_request(db)

    [alert] = notifications_for(db, "mechanic-1")
    assert alert["title"] == "New Service Request"
    assert alert["destination"] == "/mechanic/requests"
    assert alert["is_read"] is False
    assert "Jason Martinez requested Oil Change for their 2018 Honda Civic" in alert["message"]
    assert notifications_for(db, "customer-1") == []


def test_notification_failure_does_not_fail_request_submission(db):
    db["notifications"] = BrokenCollection()

    result = submit_request(db)

    assert result["message"] == "Service request submitted successfully."
    assert len(db["service_requests"].documents) == 1


def test_decline_notifies_customer(db):
    request = pending_request("customer-1")
    db["service_requests"].documents.append(request)

    update_status(request["_id"], "declined")

    [alert] = notifications_for(db, "customer-1")
    assert alert["title"] == "Service Request Declined"
    assert alert["destination"] == "/appointments"
    assert "Northside Auto declined your Oil Change request" in alert["message"]


def test_accept_notifies_customer_and_auto_declined_competitors(db):
    accepted = pending_request("customer-1")
    competing = pending_request("customer-2")
    other_time = pending_request("customer-3", start_time="10:00")
    db["service_requests"].documents.extend([accepted, competing, other_time])

    update_status(accepted["_id"], "accepted")

    [accepted_alert] = notifications_for(db, "customer-1")
    assert accepted_alert["title"] == "Service Request Accepted"
    assert "Northside Auto accepted your Oil Change appointment" in accepted_alert["message"]

    [declined_alert] = notifications_for(db, "customer-2")
    assert declined_alert["title"] == "Service Request Declined"
    assert "Another appointment was accepted for an overlapping time." in declined_alert["message"]
    assert db["service_requests"].documents[1]["status"] == "declined"

    assert notifications_for(db, "customer-3") == []
    assert db["service_requests"].documents[2]["status"] == "pending"


def test_complete_notifies_customer(db):
    request = pending_request(
        "customer-1",
        status="accepted",
        vehicle_id=db["vehicle_id"],
        appointment_date=(date.today() - timedelta(days=1)).isoformat(),
    )
    db["service_requests"].documents.append(request)

    update_status(request["_id"], "completed", completed_mileage=51000)

    [alert] = notifications_for(db, "customer-1")
    assert alert["title"] == "Service Completed"
    assert alert["destination"] == "/appointments"
    assert "Garage service history" in alert["message"]


def test_repeating_current_status_does_not_notify_again(db):
    request = pending_request("customer-1", status="accepted")
    db["service_requests"].documents.append(request)

    update_status(request["_id"], "accepted")

    assert notifications_for(db, "customer-1") == []


def test_describe_appointment_formats_date_and_time():
    assert routes.describe_appointment(
        {"appointment_date": "2026-11-09", "appointment_start_time": "13:30"}
    ) == "Mon, Nov 9 at 1:30 PM"
    assert routes.describe_appointment(
        {"appointment_date": "2026-11-09", "appointment_start_time": "00:00"}
    ) == "Mon, Nov 9 at 12:00 AM"
