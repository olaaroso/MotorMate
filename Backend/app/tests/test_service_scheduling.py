import asyncio
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from app.api import routes_mechanic
from app.api import routes_service_requests as routes
from app.models.appointment import ServiceRequestCreate, ServiceRequestStatusUpdate
from app.models.user import MechanicProfile, ServiceEstimate
from app.services import notifications as notification_service
from app.services.scheduling import (
    appointment_range,
    remove_reserved_windows,
    windows_for_date,
)
from app.services.service_estimates import normalize_service_estimates
from app.tests.fake_mongo import FakeCollection, apply_update

DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
ALL_WEEK = {day: "8:00 AM - 5:00 PM" for day in DAYS}
APPOINTMENT_DATE = date.today() + timedelta(days=7)


def starts(windows):
    return [window["start"] for window in windows]


# ---------------------------------------------------------------------------
# Scheduling helpers
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("duration", "last_start", "last_end"),
    [(30, "16:30", "17:00"), (60, "16:00", "17:00"), (90, "15:30", "17:00"), (120, "15:00", "17:00")],
)
def test_service_must_finish_by_closing(duration, last_start, last_end):
    _, windows = windows_for_date(ALL_WEEK, APPOINTMENT_DATE, duration)

    assert windows[0]["start"] == "08:00"
    assert windows[-1] == {"start": last_start, "end": last_end}
    assert all(int(w["start"][-2:]) in (0, 30) for w in windows)


def test_window_end_reflects_service_duration():
    _, windows = windows_for_date(ALL_WEEK, APPOINTMENT_DATE, 90)

    assert windows[2] == {"start": "09:00", "end": "10:30"}


def test_default_windows_are_unchanged_30_minute_blocks():
    _, windows = windows_for_date(ALL_WEEK, APPOINTMENT_DATE)

    assert windows[0] == {"start": "08:00", "end": "08:30"}
    assert len(windows) == 18


def test_reserved_range_blocks_every_overlapping_window():
    _, windows = windows_for_date(ALL_WEEK, APPOINTMENT_DATE, 60)
    reserved = [appointment_range({"appointment_start_time": "09:00", "appointment_end_time": "10:30"})]

    available = starts(remove_reserved_windows(windows, reserved))

    assert "08:00" in available
    for blocked in ("08:30", "09:00", "09:30", "10:00"):
        assert blocked not in available
    assert "10:30" in available


def test_legacy_request_without_valid_end_occupies_30_minutes():
    assert appointment_range({"appointment_start_time": "09:00"}) == (540, 570)
    assert appointment_range(
        {"appointment_start_time": "09:00", "appointment_end_time": "08:00"}
    ) == (540, 570)
    assert appointment_range({"appointment_start_time": "bad"}) is None


# ---------------------------------------------------------------------------
# Estimates on the mechanic profile
# ---------------------------------------------------------------------------

def test_normalize_service_estimates_matches_offered_services():
    result = normalize_service_estimates(
        ["Oil Change", "Brake Pad Replacement"],
        [
            {"name": "oil change", "estimated_price": 59.999, "estimated_duration_minutes": 30},
            {"name": "OIL CHANGE", "estimated_price": 1, "estimated_duration_minutes": 60},
            {"name": "Not Offered", "estimated_price": 10, "estimated_duration_minutes": 30},
            {"name": "Brake Pad Replacement", "estimated_price": None, "estimated_duration_minutes": None},
        ],
    )

    assert result == [
        {"name": "Oil Change", "estimated_price": 60.0, "estimated_duration_minutes": 30}
    ]


@pytest.mark.parametrize("duration", [0, 15, 45, 510])
def test_estimate_duration_must_be_30_minute_steps_up_to_8_hours(duration):
    with pytest.raises(ValidationError):
        ServiceEstimate(name="Oil Change", estimated_duration_minutes=duration)


def test_negative_price_is_rejected():
    with pytest.raises(ValidationError):
        ServiceEstimate(name="Oil Change", estimated_price=-1)


@pytest.fixture
def mechanics(monkeypatch):
    collection = FakeCollection()
    monkeypatch.setattr(
        routes_mechanic.db_instance, "db", {"mechanics": collection, "service_requests": FakeCollection()}
    )
    monkeypatch.setattr(
        routes_mechanic.location_service, "geocode_address", lambda address: _async(None)
    )
    return collection


async def _async(value):
    return value


def shop_profile(**extra):
    return MechanicProfile(
        owner_id="mechanic-1",
        shop_name="Northside Auto",
        street_address="1 Main St",
        city="Farmingdale",
        state="NY",
        zip_code="11735",
        services_offered=["Oil Change", "Brake Pad Replacement"],
        **extra,
    )


def test_register_saves_normalized_estimates(mechanics):
    result = asyncio.run(
        routes_mechanic.register_mechanic(
            shop_profile(
                service_estimates=[
                    {"name": "oil change", "estimated_price": 59.99, "estimated_duration_minutes": 30},
                    {"name": "Brake Pad Replacement", "estimated_duration_minutes": 90},
                ]
            )
        )
    )

    assert result["profile"]["service_estimates"] == [
        {"name": "Oil Change", "estimated_price": 59.99, "estimated_duration_minutes": 30},
        {"name": "Brake Pad Replacement", "estimated_price": None, "estimated_duration_minutes": 90},
    ]


def test_register_without_estimates_keeps_saved_estimates(mechanics):
    saved = [{"name": "Oil Change", "estimated_price": 50.0, "estimated_duration_minutes": 30}]
    mechanics.documents.append({"_id": ObjectId(), "owner_id": "mechanic-1", "service_estimates": saved})

    result = asyncio.run(routes_mechanic.register_mechanic(shop_profile()))

    assert result["profile"]["service_estimates"] == saved


# ---------------------------------------------------------------------------
# Availability and request lifecycle
# ---------------------------------------------------------------------------

@pytest.fixture
def db(monkeypatch):
    vehicle_id = ObjectId()
    database = {
        "mechanics": FakeCollection([
            {
                "_id": ObjectId(),
                "owner_id": "mechanic-1",
                "shop_name": "Northside Auto",
                "services_offered": ["Oil Change", "Brake Pad Replacement", "Engine Diagnostic"],
                "service_estimates": [
                    {"name": "Oil Change", "estimated_price": 59.99, "estimated_duration_minutes": 30},
                    {"name": "Brake Pad Replacement", "estimated_price": 220.0, "estimated_duration_minutes": 90},
                    {"name": "Engine Diagnostic", "estimated_price": 120.0, "estimated_duration_minutes": 60},
                ],
                "operating_hours": ALL_WEEK,
            }
        ]),
        "vehicles": FakeCollection([
            {"_id": vehicle_id, "owner_id": "customer-1", "year": 2018, "make": "Honda", "model": "Civic"}
        ]),
        "service_requests": FakeCollection(),
        "notifications": FakeCollection(),
        "service_history": FakeCollection(),
    }
    handle = SimpleNamespace(db=database)
    monkeypatch.setattr(routes, "db_instance", handle)
    monkeypatch.setattr(routes_mechanic, "db_instance", handle)
    monkeypatch.setattr(notification_service, "db_instance", handle)
    monkeypatch.setattr(routes, "_indexes_ready", True)
    database["vehicle_id"] = str(vehicle_id)
    return database


def stored_request(customer_id, start, end, status="pending", **extra):
    return {
        "_id": ObjectId(),
        "customer_id": customer_id,
        "customer_name": customer_id.title(),
        "mechanic_id": "mechanic-1",
        "shop_name": "Northside Auto",
        "vehicle_summary": {},
        "appointment_date": APPOINTMENT_DATE.isoformat(),
        "appointment_start_time": start,
        "appointment_end_time": end,
        "service_requested": "Brake Pad Replacement",
        "status": status,
        **extra,
    }


def available_starts(service):
    result = asyncio.run(
        routes_mechanic.get_appointment_windows("mechanic-1", APPOINTMENT_DATE, service)
    )
    return result, starts(result["windows"])


def submit(db, service, start):
    return asyncio.run(
        routes.create_service_request(
            ServiceRequestCreate(
                mechanic_id="mechanic-1",
                appointment_date=APPOINTMENT_DATE,
                appointment_start_time=start,
                customer_id="customer-1",
                customer_name="Jason Martinez",
                vehicle_id=db["vehicle_id"],
                service_requested=service,
            )
        )
    )


def accept(request_id):
    return asyncio.run(
        routes.update_service_request_status(
            str(request_id),
            ServiceRequestStatusUpdate(mechanic_id="mechanic-1", status="accepted"),
        )
    )


def test_windows_use_service_duration_and_skip_accepted_ranges(db):
    db["service_requests"].documents.extend([
        stored_request("legacy", "12:00", "12:30", status="accepted"),
        stored_request("waiting", "09:00", "10:30", status="pending"),
    ])

    result, available = available_starts("Brake Pad Replacement")

    assert result["duration_minutes"] == 90
    assert result["windows"][0] == {"start": "08:00", "end": "09:30"}
    assert "09:00" in available
    assert "10:30" in available
    for blocked in ("11:00", "11:30", "12:00"):
        assert blocked not in available
    assert "12:30" in available
    assert available[-1] == "15:30"


def test_accepted_11_to_1230_only_blocks_overlapping_90_minute_windows(db):
    db["mechanics"].documents[0]["service_estimates"][0]["estimated_duration_minutes"] = 90
    db["service_requests"].documents.append(
        stored_request("customer-1", "11:00", "12:30", status="accepted")
    )

    result, available = available_starts("Oil Change")
    windows = {window["start"]: window["end"] for window in result["windows"]}

    for start, end in [
        ("08:00", "09:30"),
        ("08:30", "10:00"),
        ("09:00", "10:30"),
        ("09:30", "11:00"),
        ("12:30", "14:00"),
    ]:
        assert windows.get(start) == end, f"{start}-{end} should be available"
    for blocked in ("10:00", "10:30", "11:00", "11:30", "12:00"):
        assert blocked not in available, f"{blocked} start should be blocked"
    assert available[:5] == ["08:00", "08:30", "09:00", "09:30", "12:30"]


def test_completed_appointments_also_block_their_time(db):
    db["mechanics"].documents[0]["service_estimates"][0]["estimated_duration_minutes"] = 90
    db["service_requests"].documents.extend([
        stored_request("customer-1", "08:00", "08:30", status="completed"),
        stored_request("customer-2", "08:30", "10:00", status="completed"),
        stored_request("customer-3", "11:00", "12:30", status="accepted"),
    ])

    _, available = available_starts("Oil Change")

    assert available[0] == "12:30"


def test_unknown_or_missing_service_uses_30_minute_windows(db):
    for service in (None, "Other / Not sure"):
        result, available = available_starts(service)
        assert result["duration_minutes"] == 30
        assert available[-1] == "16:30"


def test_request_that_runs_past_closing_is_rejected(db):
    with pytest.raises(HTTPException) as error:
        submit(db, "Engine Diagnostic", "16:30")

    assert error.value.status_code == 400
    assert "must finish before the shop closes" in error.value.detail


def test_request_stores_duration_and_estimate_snapshot(db):
    result = submit(db, "Engine Diagnostic", "16:00")["request"]

    assert result["appointment_start_time"] == "16:00"
    assert result["appointment_end_time"] == "17:00"
    assert result["appointment_duration_minutes"] == 60
    assert result["service_estimate"] == {
        "estimated_price": 120.0,
        "estimated_duration_minutes": 60,
    }


def test_request_without_estimate_defaults_to_30_minutes(db):
    result = submit(db, "Other / Not sure", "09:00")["request"]

    assert result["appointment_end_time"] == "09:30"
    assert result["appointment_duration_minutes"] == 30
    assert result["service_estimate"] == {
        "estimated_price": None,
        "estimated_duration_minutes": None,
    }


def test_request_overlapping_accepted_appointment_is_rejected(db):
    db["service_requests"].documents.append(
        stored_request("other", "09:00", "10:30", status="accepted")
    )

    with pytest.raises(HTTPException) as error:
        submit(db, "Engine Diagnostic", "10:00")
    assert error.value.status_code == 409

    assert submit(db, "Engine Diagnostic", "10:30")["request"]["status"] == "pending"


def test_pending_requests_do_not_block_new_requests(db):
    db["service_requests"].documents.append(stored_request("other", "09:00", "10:30"))

    assert submit(db, "Engine Diagnostic", "09:30")["request"]["status"] == "pending"


def test_accept_uses_stored_range_and_declines_only_overlapping_pending(db):
    target = stored_request("customer-1", "09:00", "10:30")
    overlapping = stored_request("customer-2", "10:00", "10:30")
    adjacent = stored_request("customer-3", "10:30", "11:00")
    db["service_requests"].documents.extend([target, overlapping, adjacent])
    # Changing the mechanic's estimate later must not shrink the stored appointment.
    db["mechanics"].documents[0]["service_estimates"][1]["estimated_duration_minutes"] = 30

    accept(target["_id"])

    statuses = {doc["customer_id"]: doc["status"] for doc in db["service_requests"].documents}
    assert statuses == {"customer-1": "accepted", "customer-2": "declined", "customer-3": "pending"}
    declined_alerts = [n for n in db["notifications"].documents if n["user_id"] == "customer-2"]
    assert declined_alerts[0]["title"] == "Service Request Declined"


def test_accept_rejects_overlap_with_different_start_time(db):
    db["service_requests"].documents.append(
        stored_request("other", "09:00", "10:30", status="accepted")
    )
    target = stored_request("customer-1", "10:00", "11:00")
    db["service_requests"].documents.append(target)

    with pytest.raises(HTTPException) as error:
        accept(target["_id"])

    assert error.value.status_code == 409
    assert db["service_requests"].documents[1]["status"] == "pending"


def set_hours_for_appointment_day(db, hours):
    day = DAYS[APPOINTMENT_DATE.weekday()]
    db["mechanics"].documents[0]["operating_hours"] = {**ALL_WEEK, day: hours}


def test_accept_rejects_request_outside_current_hours(db):
    target = stored_request("customer-1", "15:30", "17:00")
    db["service_requests"].documents.append(target)
    set_hours_for_appointment_day(db, "8:00 AM - 4:00 PM")

    with pytest.raises(HTTPException) as error:
        accept(target["_id"])

    assert error.value.status_code == 409
    assert "3:30 PM – 5:00 PM" in error.value.detail
    assert "8:00 AM - 4:00 PM" in error.value.detail
    assert db["service_requests"].documents[0]["status"] == "pending"
    assert db["notifications"].documents == []


def test_accept_rejects_request_when_shop_now_closed_that_day(db):
    target = stored_request("customer-1", "09:00", "09:30")
    db["service_requests"].documents.append(target)
    set_hours_for_appointment_day(db, "")

    with pytest.raises(HTTPException) as error:
        accept(target["_id"])

    assert error.value.status_code == 409
    assert "closed on" in error.value.detail
    assert db["service_requests"].documents[0]["status"] == "pending"


def test_accept_allows_request_ending_exactly_at_closing(db):
    target = stored_request("customer-1", "15:00", "16:00")
    db["service_requests"].documents.append(target)
    set_hours_for_appointment_day(db, "8:00 AM - 4:00 PM")

    accept(target["_id"])

    assert db["service_requests"].documents[0]["status"] == "accepted"


def test_accept_hours_check_uses_saved_range_not_current_estimate(db):
    # Saved as a 90-minute job; the shop now says 30 minutes, which would fit.
    target = stored_request("customer-1", "15:00", "16:30")
    db["service_requests"].documents.append(target)
    db["mechanics"].documents[0]["service_estimates"][1]["estimated_duration_minutes"] = 30
    set_hours_for_appointment_day(db, "8:00 AM - 4:00 PM")

    with pytest.raises(HTTPException) as error:
        accept(target["_id"])

    assert error.value.status_code == 409
    assert db["service_requests"].documents[0]["status"] == "pending"


def test_accept_backs_out_when_concurrent_overlap_is_accepted(db):
    target = stored_request("customer-1", "09:00", "10:00")
    racing = stored_request("customer-2", "09:30", "10:30")
    db["service_requests"].documents.extend([target, racing])

    class RacingCollection(FakeCollection):
        async def find_one_and_update(self, query, update, return_document=None):
            result = await super().find_one_and_update(query, update, return_document)
            # Another request handler accepts the overlapping request at the
            # same moment, after our pre-check already passed.
            racing_doc = next(d for d in self.documents if d["_id"] == racing["_id"])
            apply_update(racing_doc, {"$set": {"status": "accepted"}})
            return result

    db["service_requests"] = RacingCollection(db["service_requests"].documents)

    with pytest.raises(HTTPException) as error:
        accept(target["_id"])

    assert error.value.status_code == 409
    reverted = next(d for d in db["service_requests"].documents if d["_id"] == target["_id"])
    assert reverted["status"] == "pending"
    assert "responded_at" not in reverted
    assert db["notifications"].documents == []
