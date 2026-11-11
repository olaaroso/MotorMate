import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

from app.api import routes_service_request_messages as routes
from app.models.messages import ServiceRequestMessageCreate
from app.services import notifications as notification_service
from app.tests.fake_mongo import BrokenCollection, FakeCollection

CUSTOMER = "customer-1"
MECHANIC = "mechanic-1"


@pytest.fixture
def db(monkeypatch):
    database = {
        "service_requests": FakeCollection(),
        "conversations": FakeCollection(unique_fields=("service_request_id",)),
        "messages": FakeCollection(),
        "notifications": FakeCollection(),
    }
    handle = SimpleNamespace(db=database)
    monkeypatch.setattr(routes, "db_instance", handle)
    monkeypatch.setattr(notification_service, "db_instance", handle)
    monkeypatch.setattr(routes, "_indexes_ready", True)
    return database


def stored_request(db, status="pending", customer_id=CUSTOMER, mechanic_id=MECHANIC):
    document = {
        "_id": ObjectId(),
        "customer_id": customer_id,
        "customer_name": "Customer One",
        "mechanic_id": mechanic_id,
        "shop_name": "Northside Auto",
        "vehicle_id": str(ObjectId()),
        "appointment_date": "2026-11-20",
        "appointment_start_time": "09:00",
        "appointment_end_time": "09:30",
        "service_requested": "Oil Change",
        "status": status,
    }
    db["service_requests"].documents.append(document)
    return str(document["_id"])


def send(request_id, body="Could you do 1:00 PM instead?", actor_id=MECHANIC, view="mechanic"):
    return asyncio.run(
        routes.send_request_message(
            request_id,
            ServiceRequestMessageCreate(actor_id=actor_id, view=view, body=body),
        )
    )


def read_thread(request_id, actor_id=MECHANIC, view="mechanic"):
    return asyncio.run(routes.get_request_messages(request_id, actor_id, view))


def mark_read(request_id, actor_id=MECHANIC, view="mechanic"):
    return asyncio.run(routes.mark_request_messages_read(request_id, actor_id, view))


def summary(actor_id=MECHANIC, view="mechanic"):
    return asyncio.run(routes.get_message_summary(actor_id, view))["results"]


def error_from(action, *args, **kwargs):
    with pytest.raises(HTTPException) as error:
        action(*args, **kwargs)
    return error.value


def conversation(db):
    [document] = db["conversations"].documents
    return document


def test_mechanic_message_is_stored_against_the_request(db):
    request_id = stored_request(db)

    result = send(request_id)

    [stored] = db["messages"].documents
    assert stored["service_request_id"] == request_id
    assert stored["sender_role"] == "mechanic"
    assert stored["sender_id"] == MECHANIC
    assert stored["body"] == "Could you do 1:00 PM instead?"
    assert stored["kind"] == "text"
    assert stored["conversation_id"] == conversation(db)["_id"]
    assert result["sent_message"]["body"] == "Could you do 1:00 PM instead?"
    assert result["sent_message"]["sender_role"] == "mechanic"


def test_conversation_links_request_participants(db):
    request_id = stored_request(db)

    send(request_id)

    stored = conversation(db)
    assert stored["service_request_id"] == request_id
    assert stored["context"] == {"type": "service_request", "id": request_id}
    assert stored["customer_id"] == CUSTOMER
    assert stored["mechanic_id"] == MECHANIC
    assert stored["last_message_sender_role"] == "mechanic"
    assert stored["last_message_at"]


def test_both_participants_share_one_conversation(db):
    request_id = stored_request(db)

    send(request_id)
    send(request_id, "Yes, 1:00 PM works.", actor_id=CUSTOMER, view="customer")
    send(request_id, "Great, see you then.")

    assert len(db["conversations"].documents) == 1
    thread = read_thread(request_id, CUSTOMER, "customer")
    assert [m["sender_role"] for m in thread["messages"]] == ["mechanic", "customer", "mechanic"]


def test_message_body_is_trimmed(db):
    request_id = stored_request(db)

    send(request_id, "   Running ten minutes late.  \n")

    assert db["messages"].documents[0]["body"] == "Running ten minutes late."


def test_whitespace_only_message_is_rejected(db):
    request_id = stored_request(db)

    error = error_from(send, request_id, "   \n ")

    assert error.status_code == 400
    assert db["messages"].documents == []
    assert db["conversations"].documents == []


@pytest.mark.parametrize("body", ["", "x" * 1001])
def test_message_length_is_validated(body):
    with pytest.raises(ValidationError):
        ServiceRequestMessageCreate(actor_id=MECHANIC, view="mechanic", body=body)


def test_thread_is_returned_oldest_first(db):
    request_id = stored_request(db)
    send(request_id, "first")
    conversation_id = conversation(db)["_id"]
    db["messages"].documents.insert(0, {
        "_id": ObjectId(),
        "conversation_id": conversation_id,
        "service_request_id": request_id,
        "sender_role": "customer",
        "sender_id": CUSTOMER,
        "body": "earliest",
        "kind": "text",
        "created_at": "2000-01-01T00:00:00+00:00",
    })
    send(request_id, "last", actor_id=CUSTOMER, view="customer")

    bodies = [m["body"] for m in read_thread(request_id)["messages"]]

    assert bodies == ["earliest", "first", "last"]


def test_request_without_messages_has_empty_thread(db):
    request_id = stored_request(db)

    thread = read_thread(request_id, CUSTOMER, "customer")

    assert thread["messages"] == []
    assert thread["unread_count"] == 0
    assert thread["can_send"] is True
    assert db["conversations"].documents == []


@pytest.mark.parametrize("status", ["pending", "accepted"])
def test_open_requests_accept_messages(db, status):
    request_id = stored_request(db, status=status)

    send(request_id, actor_id=CUSTOMER, view="customer")
    send(request_id)

    assert len(db["messages"].documents) == 2
    assert read_thread(request_id)["can_send"] is True


@pytest.mark.parametrize("status", ["declined", "completed"])
def test_closed_requests_are_read_only(db, status):
    request_id = stored_request(db)
    send(request_id, "Before it closed")
    db["service_requests"].documents[0]["status"] = status

    for actor_id, view in ((MECHANIC, "mechanic"), (CUSTOMER, "customer")):
        error = error_from(send, request_id, "After it closed", actor_id=actor_id, view=view)
        assert error.status_code == 409
        assert status in error.detail

        thread = read_thread(request_id, actor_id, view)
        assert thread["can_send"] is False
        assert thread["status"] == status
        assert [m["body"] for m in thread["messages"]] == ["Before it closed"]

    assert len(db["messages"].documents) == 1


def test_legacy_request_without_status_is_treated_as_pending(db):
    request_id = stored_request(db)
    db["service_requests"].documents[0].pop("status")

    send(request_id)

    assert read_thread(request_id)["status"] == "pending"


@pytest.mark.parametrize(
    ("actor_id", "view"),
    [
        ("mechanic-2", "mechanic"),
        ("customer-2", "customer"),
        (CUSTOMER, "mechanic"),
        (MECHANIC, "customer"),
    ],
)
def test_non_participants_get_not_found(db, actor_id, view):
    request_id = stored_request(db)
    send(request_id)

    actions = (
        lambda: send(request_id, "hi", actor_id=actor_id, view=view),
        lambda: read_thread(request_id, actor_id, view),
        lambda: mark_read(request_id, actor_id, view),
    )
    for action in actions:
        assert error_from(action).status_code == 404

    assert len(db["messages"].documents) == 1
    assert conversation(db)["unread_count"]["customer"] == 1


def test_invalid_request_id_and_blank_actor_are_rejected(db):
    request_id = stored_request(db)

    assert error_from(read_thread, "not-an-id").status_code == 400
    assert error_from(read_thread, request_id, "   ").status_code == 400
    assert error_from(send, request_id, actor_id="   ").status_code == 400
    assert error_from(mark_read, request_id, "   ").status_code == 400


def test_mechanic_responses_never_expose_customer_or_sender_ids(db):
    request_id = stored_request(db)
    send(request_id, "Hello from the customer", actor_id=CUSTOMER, view="customer")

    responses = [
        send(request_id),
        read_thread(request_id),
        mark_read(request_id),
        summary(),
    ]

    for response in responses:
        assert CUSTOMER not in repr(response)
    for message in read_thread(request_id)["messages"]:
        assert set(message) == {"id", "sender_role", "body", "kind", "created_at"}


def test_customer_responses_never_expose_sender_ids(db):
    request_id = stored_request(db)
    send(request_id)

    thread = read_thread(request_id, CUSTOMER, "customer")

    assert MECHANIC not in repr(thread["messages"])


def test_unread_counts_track_the_recipient(db):
    request_id = stored_request(db)

    send(request_id, "one", actor_id=CUSTOMER, view="customer")
    send(request_id, "two", actor_id=CUSTOMER, view="customer")

    assert conversation(db)["unread_count"] == {"customer": 0, "mechanic": 2}
    assert read_thread(request_id)["unread_count"] == 2
    assert read_thread(request_id, CUSTOMER, "customer")["unread_count"] == 0


def test_reading_a_thread_does_not_mark_it_read(db):
    request_id = stored_request(db)
    send(request_id, actor_id=CUSTOMER, view="customer")

    read_thread(request_id)

    assert conversation(db)["unread_count"]["mechanic"] == 1


def test_mark_read_clears_only_that_participants_count(db):
    request_id = stored_request(db)
    send(request_id, "from customer", actor_id=CUSTOMER, view="customer")
    db["conversations"].documents[0]["unread_count"]["customer"] = 2

    result = mark_read(request_id)

    stored = conversation(db)
    assert result["unread_count"] == 0
    assert stored["unread_count"] == {"customer": 2, "mechanic": 0}
    assert stored["last_read_at"]["mechanic"]


def test_replying_clears_the_senders_unread_count(db):
    request_id = stored_request(db)
    send(request_id, "one", actor_id=CUSTOMER, view="customer")
    send(request_id, "two", actor_id=CUSTOMER, view="customer")

    send(request_id, "reply")

    stored = conversation(db)
    assert stored["unread_count"] == {"customer": 1, "mechanic": 0}
    assert stored["last_read_at"]["mechanic"] == stored["last_message_at"]


def test_mark_read_without_conversation_is_a_no_op(db):
    request_id = stored_request(db)

    assert mark_read(request_id)["unread_count"] == 0
    assert db["conversations"].documents == []


@pytest.mark.parametrize("status", ["declined", "completed"])
def test_closed_conversations_can_still_be_marked_read(db, status):
    request_id = stored_request(db)
    send(request_id, actor_id=CUSTOMER, view="customer")
    db["service_requests"].documents[0]["status"] = status

    mark_read(request_id)

    assert conversation(db)["unread_count"]["mechanic"] == 0


def test_summary_lists_only_the_actors_conversations(db):
    first = stored_request(db)
    second = stored_request(db)
    other_shop = stored_request(db, mechanic_id="mechanic-2")
    untouched = stored_request(db)
    send(first, "a", actor_id=CUSTOMER, view="customer")
    send(first, "b", actor_id=CUSTOMER, view="customer")
    send(second, "c")
    send(other_shop, "d", actor_id=CUSTOMER, view="customer")

    mechanic_summary = summary()

    assert set(mechanic_summary) == {first, second}
    assert mechanic_summary[first]["unread_count"] == 2
    assert mechanic_summary[first]["last_message_sender_role"] == "customer"
    assert mechanic_summary[second]["unread_count"] == 0
    assert untouched not in mechanic_summary

    customer_summary = summary(CUSTOMER, "customer")
    assert set(customer_summary) == {first, second, other_shop}
    assert customer_summary[second]["unread_count"] == 1
    assert customer_summary[other_shop]["unread_count"] == 0


def test_concurrent_first_messages_reuse_the_existing_conversation(db, monkeypatch):
    request_id = stored_request(db)
    conversations = db["conversations"]
    original = conversations.find_one_and_update

    async def racing_upsert(query, update, **kwargs):
        # The other participant's first message wins the unique index.
        conversations.find_one_and_update = original
        await original(query, update, **kwargs)
        raise DuplicateKeyError("duplicate service_request_id")

    conversations.find_one_and_update = racing_upsert

    send(request_id, "first")
    send(request_id, "second", actor_id=CUSTOMER, view="customer")

    assert len(conversations.documents) == 1
    assert len(db["messages"].documents) == 2
    assert {m["conversation_id"] for m in db["messages"].documents} == {
        conversation(db)["_id"]
    }


class ClosingMessages(FakeCollection):
    """Message collection where the mechanic closes the request mid-send."""

    def __init__(self, requests, status):
        super().__init__()
        self.requests = requests
        self.status = status

    async def insert_one(self, document):
        result = await super().insert_one(document)
        self.requests.documents[0]["status"] = self.status
        return result


@pytest.mark.parametrize("status", ["declined", "completed"])
def test_request_closing_during_send_discards_the_message(db, status):
    request_id = stored_request(db)
    send(request_id, "earlier", actor_id=CUSTOMER, view="customer")
    db["messages"] = ClosingMessages(db["service_requests"], status)

    error = error_from(send, request_id, "too late")

    assert error.status_code == 409
    assert status in error.detail
    assert db["messages"].documents == []
    stored = conversation(db)
    assert stored["unread_count"] == {"customer": 0, "mechanic": 1}
    assert stored["last_message_sender_role"] == "customer"


class FailingConversationUpdates(FakeCollection):
    """Conversations can be created, but the post-send state update fails."""

    async def find_one_and_update(self, query, update, return_document=None, upsert=False):
        if not upsert:
            raise RuntimeError("database down")
        return await super().find_one_and_update(query, update, return_document, upsert)


def test_failed_conversation_update_discards_the_message(db):
    request_id = stored_request(db)
    db["conversations"] = FailingConversationUpdates(unique_fields=("service_request_id",))

    error = error_from(send, request_id)

    assert error.status_code == 500
    assert db["messages"].documents == []
    assert read_thread(request_id, CUSTOMER, "customer")["messages"] == []
    assert summary(CUSTOMER, "customer") == {}


def test_failed_cleanup_still_reports_the_send_failure(db):
    class UndeletableMessages(FakeCollection):
        async def delete_one(self, query):
            raise RuntimeError("database down")

    request_id = stored_request(db)
    db["conversations"] = FailingConversationUpdates(unique_fields=("service_request_id",))
    db["messages"] = UndeletableMessages()

    assert error_from(send, request_id).status_code == 500


def notifications_for(db, user_id):
    return [doc for doc in db["notifications"].documents if doc["user_id"] == user_id]


def test_customer_message_notifies_the_mechanic(db):
    request_id = stored_request(db)

    send(request_id, "Can I drop it off early?", actor_id=CUSTOMER, view="customer")

    [alert] = notifications_for(db, MECHANIC)
    assert alert["title"] == "New Message"
    assert alert["message"] == (
        "Customer One sent you a message about their Oil Change request "
        "for Fri, Nov 20 at 9:00 AM."
    )
    assert alert["destination"] == f"/mechanic/requests?request={request_id}"
    assert alert["is_read"] is False
    assert notifications_for(db, CUSTOMER) == []


def test_mechanic_message_notifies_the_customer(db):
    request_id = stored_request(db)

    send(request_id)

    [alert] = notifications_for(db, CUSTOMER)
    assert alert["title"] == "New Message from Northside Auto"
    assert alert["message"] == (
        "Northside Auto sent you a message about your Oil Change request "
        "for Fri, Nov 20 at 9:00 AM."
    )
    assert alert["destination"] == f"/appointments?request={request_id}"
    assert notifications_for(db, MECHANIC) == []


def test_notifications_never_include_the_message_body(db):
    request_id = stored_request(db)
    secret = "My gate code is 4321"

    send(request_id, secret, actor_id=CUSTOMER, view="customer")
    send(request_id, secret)

    assert len(db["notifications"].documents) == 2
    for alert in db["notifications"].documents:
        assert "4321" not in repr(alert)


def test_messages_during_an_unread_streak_notify_once(db):
    request_id = stored_request(db)

    send(request_id, "one", actor_id=CUSTOMER, view="customer")
    send(request_id, "two", actor_id=CUSTOMER, view="customer")
    send(request_id, "three", actor_id=CUSTOMER, view="customer")

    assert len(notifications_for(db, MECHANIC)) == 1
    assert conversation(db)["unread_count"]["mechanic"] == 3


def test_marking_read_starts_a_new_notification_streak(db):
    request_id = stored_request(db)
    send(request_id, "one", actor_id=CUSTOMER, view="customer")
    send(request_id, "two", actor_id=CUSTOMER, view="customer")

    mark_read(request_id)
    send(request_id, "three", actor_id=CUSTOMER, view="customer")

    assert len(notifications_for(db, MECHANIC)) == 2


def test_replying_does_not_notify_the_sender_again(db):
    request_id = stored_request(db)

    send(request_id, "question", actor_id=CUSTOMER, view="customer")
    send(request_id, "answer")
    send(request_id, "follow-up", actor_id=CUSTOMER, view="customer")

    # The mechanic never marked the thread read, but replying cleared their
    # unread count, so the customer's follow-up starts a new streak.
    assert len(notifications_for(db, MECHANIC)) == 2
    assert len(notifications_for(db, CUSTOMER)) == 1


def test_notification_failure_does_not_fail_the_send(db):
    request_id = stored_request(db)
    db["notifications"] = BrokenCollection()

    result = send(request_id, actor_id=CUSTOMER, view="customer")

    assert result["message"] == "Message sent."
    assert len(db["messages"].documents) == 1
    assert conversation(db)["unread_count"]["mechanic"] == 1


def test_discarded_message_does_not_notify(db):
    request_id = stored_request(db)
    db["messages"] = ClosingMessages(db["service_requests"], "declined")

    error_from(send, request_id, actor_id=CUSTOMER, view="customer")

    assert db["notifications"].documents == []
