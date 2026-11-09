import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.api import routes_notifications
from app.services import notifications as notification_service


def matches(document: dict, query: dict) -> bool:
    for key, expected in query.items():
        actual = document.get(key)
        if expected is None:
            if actual is not None:
                return False
        elif actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, field, direction):
        self.documents.sort(key=lambda doc: doc.get(field) or "", reverse=direction < 0)
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

    async def insert_one(self, document):
        document = dict(document)
        document.setdefault("_id", ObjectId())
        self.documents.append(document)
        return SimpleNamespace(inserted_id=document["_id"])

    def find(self, query):
        return FakeCursor([dict(doc) for doc in self.documents if matches(doc, query)])

    async def find_one(self, query):
        for doc in self.documents:
            if matches(doc, query):
                return dict(doc)
        return None

    async def update_one(self, query, update):
        for doc in self.documents:
            if matches(doc, query):
                doc.update(update["$set"])
                return SimpleNamespace(matched_count=1, modified_count=1)
        return SimpleNamespace(matched_count=0, modified_count=0)

    async def update_many(self, query, update):
        matched = [doc for doc in self.documents if matches(doc, query)]
        for doc in matched:
            doc.update(update["$set"])
        return SimpleNamespace(matched_count=len(matched), modified_count=len(matched))


def notification(user_id, title, created_at, **extra):
    return {
        "_id": ObjectId(),
        "user_id": user_id,
        "title": title,
        "message": f"{title} message",
        "is_read": False,
        "created_at": created_at,
        **extra,
    }


@pytest.fixture
def notifications(monkeypatch):
    collection = FakeCollection(
        [
            notification("user-1", "Old", "2026-11-01T10:00:00+00:00"),
            notification("user-1", "New", "2026-11-02T10:00:00+00:00"),
            notification(
                "user-1",
                "Previously cleared",
                "2026-10-30T10:00:00+00:00",
                is_read=True,
                cleared_at="2026-10-31T10:00:00+00:00",
            ),
            notification("user-2", "Someone else", "2026-11-03T10:00:00+00:00"),
        ]
    )
    monkeypatch.setattr(
        routes_notifications.db_instance, "db", {"notifications": collection}
    )
    return collection


def titles(results):
    return [item["title"] for item in results]


def test_normal_view_hides_cleared_notifications(notifications):
    results = asyncio.run(
        routes_notifications.get_user_notifications("user-1", include_cleared=False)
    )

    assert titles(results) == ["New", "Old"]


def test_history_includes_cleared_notifications(notifications):
    results = asyncio.run(
        routes_notifications.get_user_notifications("user-1", include_cleared=True)
    )

    assert titles(results) == ["New", "Old", "Previously cleared"]
    assert results[2]["cleared_at"] == "2026-10-31T10:00:00+00:00"


def test_clear_notification_keeps_it_in_history(notifications):
    target = notifications.documents[0]

    cleared = asyncio.run(
        routes_notifications.clear_notification(str(target["_id"]), user_id="user-1")
    )

    assert cleared["is_read"] is True
    assert cleared["cleared_at"]
    visible = asyncio.run(
        routes_notifications.get_user_notifications("user-1", include_cleared=False)
    )
    history = asyncio.run(
        routes_notifications.get_user_notifications("user-1", include_cleared=True)
    )
    assert titles(visible) == ["New"]
    assert "Old" in titles(history)
    assert len(notifications.documents) == 4


def test_clearing_twice_keeps_original_cleared_time(notifications):
    target = notifications.documents[2]

    result = asyncio.run(
        routes_notifications.clear_notification(str(target["_id"]), user_id="user-1")
    )

    assert result["cleared_at"] == "2026-10-31T10:00:00+00:00"


def test_user_cannot_clear_or_read_another_users_notification(notifications):
    other = notifications.documents[3]

    for action in (
        routes_notifications.clear_notification,
        routes_notifications.mark_notification_as_read,
    ):
        with pytest.raises(HTTPException) as error:
            asyncio.run(action(str(other["_id"]), user_id="user-1"))
        assert error.value.status_code == 404

    assert other["is_read"] is False
    assert other.get("cleared_at") is None


def test_clear_all_only_affects_that_users_visible_notifications(notifications):
    result = asyncio.run(routes_notifications.clear_all_notifications("user-1"))

    assert result["modified_count"] == 2
    assert asyncio.run(
        routes_notifications.get_user_notifications("user-1", include_cleared=False)
    ) == []
    assert len(asyncio.run(
        routes_notifications.get_user_notifications("user-1", include_cleared=True)
    )) == 3
    assert titles(asyncio.run(
        routes_notifications.get_user_notifications("user-2", include_cleared=False)
    )) == ["Someone else"]


def test_create_notification_stores_unread_notification(monkeypatch):
    collection = FakeCollection()
    monkeypatch.setattr(
        notification_service.db_instance, "db", {"notifications": collection}
    )

    stored = asyncio.run(
        notification_service.create_notification(
            " mechanic-1 ", "New Service Request", "Details", destination="/mechanic/requests"
        )
    )

    assert stored is True
    saved = collection.documents[0]
    assert saved["user_id"] == "mechanic-1"
    assert saved["is_read"] is False
    assert saved["destination"] == "/mechanic/requests"
    assert "cleared_at" not in saved


def test_create_notification_never_raises(monkeypatch):
    class BrokenCollection:
        async def insert_one(self, document):
            raise RuntimeError("database down")

    monkeypatch.setattr(
        notification_service.db_instance, "db", {"notifications": BrokenCollection()}
    )

    assert asyncio.run(
        notification_service.create_notification("user-1", "Title", "Message")
    ) is False
    assert asyncio.run(
        notification_service.create_notification("", "Title", "Message")
    ) is False
