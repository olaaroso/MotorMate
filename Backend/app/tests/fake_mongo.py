"""Small in-memory stand-ins for the Motor collection methods the routes use."""

from types import SimpleNamespace

from bson import ObjectId
from pymongo import ReturnDocument


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


def apply_update(document: dict, update: dict):
    for key, value in update.get("$set", {}).items():
        if "." in key:
            parent, child = key.split(".", 1)
            document.setdefault(parent, {})[child] = value
        else:
            document[key] = value
    for key in update.get("$unset", {}):
        document.pop(key, None)


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
                apply_update(doc, update)
                return dict(doc) if return_document == ReturnDocument.AFTER else None
        return None

    async def update_one(self, query, update, upsert=False):
        for doc in self.documents:
            if matches(doc, query):
                apply_update(doc, update)
                return SimpleNamespace(matched_count=1, modified_count=1)
        if upsert:
            document = {**query, **update.get("$setOnInsert", {})}
            apply_update(document, update)
            await self.insert_one(document)
        return SimpleNamespace(matched_count=0, modified_count=0)


class BrokenCollection(FakeCollection):
    async def insert_one(self, document):
        raise RuntimeError("database down")
