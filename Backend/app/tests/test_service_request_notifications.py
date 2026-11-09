import asyncio
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from bson import ObjectId
from pymongo import ReturnDocument

from app.api import routes_service_requests as routes
from app.models.appointment import ServiceRequestCreate, ServiceRequestStatusUpdate
from app.services import notifications as notification_service

ALL_WEEK = {
    day: "8:00 AM - 5:00 PM"
    for day in (
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    )
}
APPOINTMENT_DATE = date.today() + timedelta(days=7)


def matches(document: dict, query: dict) -> bool:
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict) and any(op.startswith("$") for op in expected):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
        elif expected is None:
            if actual is not None:
                return False
        elif actual != expected:
            return False
    return True


def apply_set(document: dict, values: dict):
    for key, value in values.items():
        if "." in key:
            parent, child = key.split(".", 1)
            document.setdefault(parent, {})[child] = value
        else:
            document[key] = value


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, *args, **kwargs):
        return self

    def __aiter__(self):
        self._iterator = iter(self.documents)
        return self

    async def __anext__(self):
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = [dict(doc) for doc in documents or []]

    async def create_index(self, *args, **kwargs):
        return None

    async def insert_one(self, document):
        document.setdefault("_id", ObjectId())
        self.documents.append(dict(document))
        return SimpleNamespace(inserted_id=document["_id"])

    def find(self, query, projection=None):
        return FakeCursor([dict(doc) for doc in self.documents if matches(doc, query)])

    async def find_one(self, query):
        for doc in self.documents:
            if matches(doc, query):
                return dict(doc)
        return None

    async def find_one_and_update(self, query, update, return_document=None):
        for doc in self.documents:
            if matches(doc, query):
                apply_set(doc, update.get("$set", {}))
                return dict(doc) if return_document == ReturnDocument.AFTER else None
        return None

    async def update_one(self, query, update, upsert=False):
        for doc in self.documents:
            if matches(doc, query):
                apply_set(doc, update.get("$set", {}))
                return SimpleNamespace(matched_count=1)
        if upsert:
            document = {**query, **update.get("$setOnInsert", {})}
            apply_set(document, update.get("$set", {}))
            await self.insert_one(document)
        return SimpleNamespace(matched_count=0)


class BrokenCollection(FakeCollection):
    async def insert_one(self, document):
        raise RuntimeError("database down")


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
    assert "Another request was accepted for this appointment time." in declined_alert["message"]
    assert db["service_requests"].documents[1]["status"] == "declined"

    assert notifications_for(db, "customer-3") == []
    assert db["service_requests"].documents[2]["status"] == "pending"


def test_complete_notifies_customer(db):
    request = pending_request("customer-1", status="accepted", vehicle_id=db["vehicle_id"])
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
