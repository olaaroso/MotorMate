import asyncio
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from app.api import routes_mechanic
from app.api import routes_service_request_messages as message_routes
from app.api import routes_service_requests as routes
from app.models.appointment import (
    ServiceRequestCancel,
    ServiceRequestCreate,
    ServiceRequestStatusUpdate,
)
from app.models.messages import ServiceRequestMessageCreate
from app.services import notifications as notification_service
from app.tests.fake_mongo import BrokenCollection, FakeCollection

CUSTOMER = "customer-1"
MECHANIC = "mechanic-1"
ALL_WEEK = {
    day: "8:00 AM - 5:00 PM"
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
}
APPOINTMENT_DATE = date.today() + timedelta(days=7)


@pytest.fixture
def db(monkeypatch):
    vehicle_id = ObjectId()
    database = {
        "mechanics": FakeCollection([
            {
                "_id": ObjectId(),
                "owner_id": MECHANIC,
                "shop_name": "Northside Auto",
                "services_offered": ["Brake Pad Replacement"],
                "service_estimates": [
                    {"name": "Brake Pad Replacement", "estimated_price": 220.0, "estimated_duration_minutes": 90},
                ],
                "operating_hours": ALL_WEEK,
            }
        ]),
        "vehicles": FakeCollection([
            {"_id": vehicle_id, "owner_id": CUSTOMER, "year": 2018, "make": "Honda", "model": "Civic"}
        ]),
        "service_requests": FakeCollection(),
        "notifications": FakeCollection(),
        "service_history": FakeCollection(),
        "conversations": FakeCollection(unique_fields=("service_request_id",)),
        "messages": FakeCollection(),
    }
    handle = SimpleNamespace(db=database)
    for module in (routes, routes_mechanic, message_routes, notification_service):
        monkeypatch.setattr(module, "db_instance", handle)
    monkeypatch.setattr(routes, "_indexes_ready", True)
    monkeypatch.setattr(message_routes, "_indexes_ready", True)
    database["vehicle_id"] = str(vehicle_id)
    return database


def stored_request(db, status="pending", start="09:00", end="10:30", customer_id=CUSTOMER):
    document = {
        "_id": ObjectId(),
        "customer_id": customer_id,
        "customer_name": "Customer One",
        "mechanic_id": MECHANIC,
        "shop_name": "Northside Auto",
        "vehicle_id": db["vehicle_id"],
        "vehicle_summary": {"year": 2018, "make": "Honda", "model": "Civic"},
        "appointment_date": APPOINTMENT_DATE.isoformat(),
        "appointment_start_time": start,
        "appointment_end_time": end,
        "service_requested": "Brake Pad Replacement",
        "status": status,
    }
    db["service_requests"].documents.append(document)
    return str(document["_id"])


def stored(db, request_id):
    return next(d for d in db["service_requests"].documents if str(d["_id"]) == request_id)


def cancel(request_id, actor_id=CUSTOMER, view="customer", reason=None):
    return asyncio.run(
        routes.cancel_service_request(
            request_id,
            ServiceRequestCancel(actor_id=actor_id, view=view, reason=reason),
        )
    )


def cancel_error(*args, **kwargs):
    with pytest.raises(HTTPException) as error:
        cancel(*args, **kwargs)
    return error.value


def notifications_for(db, user_id):
    return [doc for doc in db["notifications"].documents if doc["user_id"] == user_id]


def available_starts():
    result = asyncio.run(
        routes_mechanic.get_appointment_windows(MECHANIC, APPOINTMENT_DATE, "Brake Pad Replacement")
    )
    return [window["start"] for window in result["windows"]]


@pytest.mark.parametrize("status", ["pending", "accepted"])
def test_customer_can_cancel_pending_or_accepted_requests(db, status):
    request_id = stored_request(db, status=status)

    result = cancel(request_id)

    assert result["request"]["status"] == "cancelled"
    assert result["message"] == (
        "Appointment cancelled." if status == "accepted" else "Request cancelled."
    )
    assert stored(db, request_id)["status"] == "cancelled"


def test_mechanic_can_cancel_accepted_appointment(db):
    request_id = stored_request(db, status="accepted")

    result = cancel(request_id, MECHANIC, "mechanic")

    assert result["request"]["status"] == "cancelled"
    assert result["request"]["cancelled_by"] == "mechanic"
    assert "customer_id" not in result["request"]
    assert "vehicle_id" not in result["request"]


def test_mechanic_must_decline_pending_requests_instead(db):
    request_id = stored_request(db)

    error = cancel_error(request_id, MECHANIC, "mechanic")

    assert error.status_code == 409
    assert "Decline" in error.detail
    assert stored(db, request_id)["status"] == "pending"


@pytest.mark.parametrize("status", ["declined", "completed", "cancelled"])
@pytest.mark.parametrize(("actor_id", "view"), [(CUSTOMER, "customer"), (MECHANIC, "mechanic")])
def test_closed_requests_cannot_be_cancelled(db, status, actor_id, view):
    request_id = stored_request(db, status=status)

    error = cancel_error(request_id, actor_id, view)

    assert error.status_code == 409
    assert status in error.detail
    assert stored(db, request_id)["status"] == status
    assert "cancelled_at" not in stored(db, request_id)
    assert db["notifications"].documents == []


@pytest.mark.parametrize(
    ("actor_id", "view"),
    [
        ("customer-2", "customer"),
        ("mechanic-2", "mechanic"),
        (MECHANIC, "customer"),
        (CUSTOMER, "mechanic"),
    ],
)
def test_wrong_participant_gets_not_found(db, actor_id, view):
    request_id = stored_request(db, status="accepted")

    assert cancel_error(request_id, actor_id, view).status_code == 404
    assert stored(db, request_id)["status"] == "accepted"


def test_invalid_request_id_and_blank_actor_are_rejected(db):
    request_id = stored_request(db)

    assert cancel_error("not-an-id").status_code == 400
    assert cancel_error(request_id, actor_id="   ").status_code == 400


@pytest.mark.parametrize(("actor_id", "view"), [(CUSTOMER, "customer"), (MECHANIC, "mechanic")])
def test_cancellation_records_who_and_when_from_the_server(db, actor_id, view):
    request_id = stored_request(db, status="accepted")

    cancel(request_id, actor_id, view)

    document = stored(db, request_id)
    assert document["cancelled_by"] == view
    assert document["cancelled_at"]
    assert "cancel_reason" not in document
    assert document["appointment_start_time"] == "09:00"


def test_client_cannot_supply_cancelled_by(db):
    request_id = stored_request(db, status="accepted")
    payload = ServiceRequestCancel(actor_id=CUSTOMER, view="customer", cancelled_by="mechanic")

    asyncio.run(routes.cancel_service_request(request_id, payload))

    assert stored(db, request_id)["cancelled_by"] == "customer"


def test_reason_is_trimmed_and_blank_reasons_are_dropped(db):
    with_reason = stored_request(db)
    blank_reason = stored_request(db, start="13:00", end="14:30")

    cancel(with_reason, reason="  Car is fixed already.  \n")
    cancel(blank_reason, reason="   ")

    assert stored(db, with_reason)["cancel_reason"] == "Car is fixed already."
    assert "cancel_reason" not in stored(db, blank_reason)


def test_reason_length_is_limited():
    with pytest.raises(ValidationError):
        ServiceRequestCancel(actor_id=CUSTOMER, view="customer", reason="x" * 501)


def test_status_change_between_check_and_write_is_not_overwritten(db, monkeypatch):
    request_id = stored_request(db)
    requests = db["service_requests"]
    original_find_one = requests.find_one

    async def mechanic_accepts_meanwhile(query):
        document = await original_find_one(query)
        stored(db, request_id)["status"] = "accepted"
        return document

    monkeypatch.setattr(requests, "find_one", mechanic_accepts_meanwhile)

    error = cancel_error(request_id)

    assert error.status_code == 409
    assert stored(db, request_id)["status"] == "accepted"
    assert db["notifications"].documents == []


def test_cancelled_request_cannot_be_accepted_or_completed_afterwards(db):
    pending_id = stored_request(db)
    accepted_id = stored_request(db, status="accepted", start="13:00", end="14:30")
    cancel(pending_id)
    cancel(accepted_id)

    for request_id, status in ((pending_id, "accepted"), (accepted_id, "completed")):
        with pytest.raises(HTTPException) as error:
            asyncio.run(
                routes.update_service_request_status(
                    request_id,
                    ServiceRequestStatusUpdate(mechanic_id=MECHANIC, status=status),
                )
            )
        assert error.value.status_code == 409
        assert stored(db, request_id)["status"] == "cancelled"


# ---------------------------------------------------------------------------
# Scheduling
# ---------------------------------------------------------------------------

def test_cancelled_accepted_appointment_frees_its_interval(db):
    request_id = stored_request(db, status="accepted", start="09:00", end="10:30")
    blocked = {"08:00", "08:30", "09:00", "09:30", "10:00"}
    assert not blocked & set(available_starts())

    cancel(request_id, MECHANIC, "mechanic")

    assert blocked <= set(available_starts())


def test_cancelled_interval_can_be_requested_and_accepted_again(db):
    request_id = stored_request(db, status="accepted", start="09:00", end="10:30")
    cancel(request_id)

    result = asyncio.run(
        routes.create_service_request(
            ServiceRequestCreate(
                mechanic_id=MECHANIC,
                appointment_date=APPOINTMENT_DATE,
                appointment_start_time="09:00",
                customer_id=CUSTOMER,
                customer_name="Customer One",
                vehicle_id=db["vehicle_id"],
                service_requested="Brake Pad Replacement",
            )
        )
    )
    new_id = result["request"]["id"]

    accepted = asyncio.run(
        routes.update_service_request_status(
            new_id, ServiceRequestStatusUpdate(mechanic_id=MECHANIC, status="accepted")
        )
    )

    assert accepted["request"]["status"] == "accepted"
    assert stored(db, request_id)["status"] == "cancelled"


def test_cancelled_request_does_not_block_accepting_an_overlapping_one(db):
    cancelled_id = stored_request(db, status="accepted", start="09:00", end="10:30")
    overlapping_id = stored_request(db, start="10:00", end="11:30", customer_id="customer-2")
    cancel(cancelled_id, MECHANIC, "mechanic")

    asyncio.run(
        routes.update_service_request_status(
            overlapping_id, ServiceRequestStatusUpdate(mechanic_id=MECHANIC, status="accepted")
        )
    )

    assert stored(db, overlapping_id)["status"] == "accepted"
    assert stored(db, cancelled_id)["status"] == "cancelled"


def test_cancelled_requests_still_appear_in_both_lists(db):
    request_id = stored_request(db, status="accepted")
    cancel(request_id)

    mechanic_list = asyncio.run(routes.get_mechanic_service_requests(MECHANIC, None))["results"]
    customer_list = asyncio.run(routes.get_customer_service_requests(CUSTOMER, "cancelled"))["results"]

    assert [item["status"] for item in mechanic_list] == ["cancelled"]
    assert [item["id"] for item in customer_list] == [request_id]


# ---------------------------------------------------------------------------
# Messaging
# ---------------------------------------------------------------------------

def test_cancelled_thread_is_readable_but_read_only(db):
    request_id = stored_request(db, status="accepted")
    asyncio.run(
        message_routes.send_request_message(
            request_id,
            ServiceRequestMessageCreate(actor_id=CUSTOMER, view="customer", body="See you then"),
        )
    )

    cancel(request_id, MECHANIC, "mechanic")

    for actor_id, view in ((CUSTOMER, "customer"), (MECHANIC, "mechanic")):
        thread = asyncio.run(message_routes.get_request_messages(request_id, actor_id, view))
        assert thread["status"] == "cancelled"
        assert thread["can_send"] is False
        assert [m["body"] for m in thread["messages"]] == ["See you then"]

        with pytest.raises(HTTPException) as error:
            asyncio.run(
                message_routes.send_request_message(
                    request_id,
                    ServiceRequestMessageCreate(actor_id=actor_id, view=view, body="hello?"),
                )
            )
        assert error.value.status_code == 409
        assert "cancelled" in error.value.detail

    assert len(db["messages"].documents) == 1


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

def test_customer_cancellation_notifies_the_mechanic(db):
    request_id = stored_request(db, status="accepted")

    cancel(request_id, reason="Found another shop")

    [alert] = notifications_for(db, MECHANIC)
    assert alert["title"] == "Appointment Cancelled"
    assert alert["message"].startswith(
        "Customer One cancelled their Brake Pad Replacement appointment for "
    )
    assert alert["message"].endswith("Reason: Found another shop")
    assert alert["destination"] == f"/mechanic/requests?request={request_id}"
    assert notifications_for(db, CUSTOMER) == []


def test_customer_cancelling_a_pending_request_calls_it_a_request(db):
    request_id = stored_request(db)

    cancel(request_id)

    [alert] = notifications_for(db, MECHANIC)
    assert "Brake Pad Replacement request for" in alert["message"]


def test_mechanic_cancellation_notifies_the_customer(db):
    request_id = stored_request(db, status="accepted")

    cancel(request_id, MECHANIC, "mechanic")

    [alert] = notifications_for(db, CUSTOMER)
    assert alert["title"] == "Appointment Cancelled by Northside Auto"
    assert alert["message"].startswith(
        "Northside Auto cancelled your Brake Pad Replacement appointment on "
    )
    assert "Reason" not in alert["message"]
    assert alert["destination"] == f"/appointments?request={request_id}"
    assert notifications_for(db, MECHANIC) == []


def test_cancellation_notification_never_includes_message_content(db):
    request_id = stored_request(db, status="accepted")
    asyncio.run(
        message_routes.send_request_message(
            request_id,
            ServiceRequestMessageCreate(actor_id=MECHANIC, view="mechanic", body="Gate code 4321"),
        )
    )

    cancel(request_id)

    assert "4321" not in repr(notifications_for(db, MECHANIC))


def test_notification_failure_does_not_undo_cancellation(db):
    request_id = stored_request(db, status="accepted")
    db["notifications"] = BrokenCollection()

    result = cancel(request_id)

    assert result["request"]["status"] == "cancelled"
    assert stored(db, request_id)["status"] == "cancelled"
