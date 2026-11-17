"""Small in-memory stand-ins for the Motor collection methods the routes use."""

from copy import deepcopy
from types import SimpleNamespace

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


def get_path(document: dict, key: str, default=None):
    value = document
    for part in key.split("."):
        if isinstance(value, list) and part.isdecimal() and int(part) < len(value):
            value = value[int(part)]
            continue
        if not isinstance(value, dict):
            return default
        value = value.get(part, default)
    return value


def set_path(document: dict, key: str, value):
    *parents, leaf = key.split(".")
    target = document
    for part in parents:
        target = target.setdefault(part, {})
    target[leaf] = value


def unset_path(document: dict, key: str):
    *parents, leaf = key.split(".")
    target = document
    for part in parents:
        target = target.get(part)
        if not isinstance(target, dict):
            return
    target.pop(leaf, None)


def matches(document: dict, query: dict) -> bool:
    missing = object()
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(document, alternative) for alternative in expected):
                return False
            continue
        actual = get_path(document, key)
        if isinstance(expected, dict) and any(op.startswith("$") for op in expected):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            if "$exists" in expected and (get_path(document, key, missing) is not missing) != expected["$exists"]:
                return False
            if "$gt" in expected and (actual is None or actual <= expected["$gt"]):
                return False
            if "$lte" in expected and (actual is None or actual > expected["$lte"]):
                return False
            if "$gte" in expected and (actual is None or actual < expected["$gte"]):
                return False
        elif expected is None:
            if actual is not None:
                return False
        elif actual != expected:
            return False
    return True


def evaluate(expression, document):
    if isinstance(expression, str) and expression.startswith("$"):
        return get_path(document, expression[1:])
    if not isinstance(expression, dict):
        return expression
    if "$literal" in expression:
        return expression["$literal"]
    if "$type" in expression:
        return "object" if isinstance(evaluate(expression["$type"], document), dict) else None
    if "$ifNull" in expression:
        value, fallback = expression["$ifNull"]
        result = evaluate(value, document)
        return evaluate(fallback, document) if result is None else result
    if "$eq" in expression:
        left, right = expression["$eq"]
        return evaluate(left, document) == evaluate(right, document)
    if "$cond" in expression:
        test, yes, no = expression["$cond"]
        return evaluate(yes if evaluate(test, document) else no, document)
    if "$mergeObjects" in expression:
        return {key: value for part in expression["$mergeObjects"]
                for key, value in evaluate(part, document).items()}
    return {key: evaluate(value, document) for key, value in expression.items()}


def apply_update(document: dict, update: dict | list, inserting: bool = False):
    if isinstance(update, list):
        for stage in update:
            fields = {key: evaluate(value, document) for key, value in stage["$set"].items()}
            for key, value in fields.items():
                set_path(document, key, value)
        return
    if inserting:
        for key, value in update.get("$setOnInsert", {}).items():
            set_path(document, key, value)
    for key, value in update.get("$set", {}).items():
        set_path(document, key, value)
    for key, amount in update.get("$inc", {}).items():
        set_path(document, key, (get_path(document, key) or 0) + amount)
    for key in update.get("$unset", {}):
        unset_path(document, key)


def sort_key(value):
    # None sorts first, like MongoDB's ordering of missing/null values.
    return (value is not None, value if value is not None else "")


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, key_or_list, direction=1):
        keys = key_or_list if isinstance(key_or_list, list) else [(key_or_list, direction)]
        # Stable sorts applied from the last key to the first give a multi-key sort.
        for field, field_direction in reversed(keys):
            self.documents.sort(
                key=lambda doc: sort_key(get_path(doc, field)),
                reverse=field_direction < 0,
            )
        return self

    def limit(self, count):
        if count:
            self.documents = self.documents[:count]
        return self

    async def to_list(self, length=None):
        return self.documents if length is None else self.documents[:length]

    def __aiter__(self):
        self._iterator = iter(self.documents)
        return self

    async def __anext__(self):
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration


class FakeCollection:
    def __init__(self, documents=None, unique_fields=()):
        self.documents = [dict(doc) for doc in documents or []]
        self.unique_fields = tuple(unique_fields)

    async def create_index(self, *args, **kwargs):
        return None

    async def insert_one(self, document):
        document.setdefault("_id", ObjectId())
        for field in self.unique_fields:
            if any(get_path(doc, field) == get_path(document, field) for doc in self.documents):
                raise DuplicateKeyError(f"duplicate {field}")
        self.documents.append(dict(document))
        return SimpleNamespace(inserted_id=document["_id"])

    def find(self, query, projection=None):
        return FakeCursor([dict(doc) for doc in self.documents if matches(doc, query)])

    async def find_one(self, query, projection=None):
        for doc in self.documents:
            if matches(doc, query):
                return deepcopy(doc)
        return None

    async def count_documents(self, query):
        return sum(matches(doc, query) for doc in self.documents)

    async def find_one_and_update(self, query, update, return_document=None, upsert=False):
        for doc in self.documents:
            if matches(doc, query):
                before = deepcopy(doc)
                apply_update(doc, update)
                return deepcopy(doc) if return_document == ReturnDocument.AFTER else before
        if upsert:
            document = {
                key: value
                for key, value in query.items()
                if not isinstance(value, dict)
            }
            apply_update(document, update, inserting=True)
            await self.insert_one(document)
            return dict(document) if return_document == ReturnDocument.AFTER else None
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

    async def update_many(self, query, update):
        count = 0
        for doc in self.documents:
            if matches(doc, query):
                apply_update(doc, update)
                count += 1
        return SimpleNamespace(matched_count=count, modified_count=count)

    async def delete_one(self, query):
        for index, doc in enumerate(self.documents):
            if matches(doc, query):
                del self.documents[index]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)


class BrokenCollection(FakeCollection):
    async def insert_one(self, document):
        raise RuntimeError("database down")
