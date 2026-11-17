import asyncio
import base64
import unittest
from collections import defaultdict
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from bson import ObjectId
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.api import routes_diy
from app.core import firebase_auth
from app.core.database import db_instance
from app.main import app
from app.ml_pipeline import cpu_model
from app.tests.fake_mongo import FakeCollection


class FakeDatabase(defaultdict):
    async def command(self, command):
        assert command == "ping"
        return {"ok": 1}


def jpeg():
    buffer = BytesIO()
    Image.new("RGB", (24, 24), color="red").save(buffer, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def decode_fixture_token(token, *, app):
    if not token.startswith("fixture-"):
        raise ValueError("Invalid test token")
    return {"uid": token.removeprefix("fixture-")}


class TestDeployment(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDatabase(FakeCollection)
        self.today = date.today()
        self.listing_id, self.rental_id, self.vehicle_id = [str(ObjectId()) for _ in range(3)]
        self.rental_url = f"/api/diy/rental-requests/{self.rental_id}"
        self.vehicle_url = f"/api/vin/vehicles/{self.vehicle_id}"
        self.db["tool_listings"] = FakeCollection([{
            "_id": ObjectId(self.listing_id), "owner_id": "owner", "availability": "available",
            "item_name": "Fixture Wrench", "pickup_address": "Private Legacy Field",
        }])
        self.db["tool_rental_requests"] = FakeCollection([{
            "_id": ObjectId(self.rental_id), "owner_id": "owner", "renter_id": "borrower",
            "listing_id": self.listing_id, "status": "approved", "tool_name": "Fixture Wrench",
            "start_date": self.today.isoformat(), "end_date": (self.today + timedelta(days=1)).isoformat(),
        }])
        self.db["tool_handoff_details"] = FakeCollection([{
            "listing_id": self.listing_id, "pickup_address": "Fixture Address",
        }])
        self.db["vehicles"] = FakeCollection([{
            "_id": ObjectId(self.vehicle_id), "owner_id": "customer",
            "make": "Honda", "model": "Civic", "year": 2018, "current_mileage": 90000,
        }])
        self.db["mechanics"] = FakeCollection([{
            "_id": ObjectId(), "owner_id": "mechanic", "shop_name": "Fixture Shop",
            "services_offered": ["Oil Change"],
            "operating_hours": {day: "8:00 AM - 5:00 PM" for day in (
                "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
            )},
        }])
        for mock in (
            patch.object(db_instance, "db", self.db),
            patch.object(firebase_auth, "_firebase_app", return_value=object()),
            patch.object(firebase_auth.auth, "verify_id_token", side_effect=decode_fixture_token),
        ):
            mock.start()
            self.addCleanup(mock.stop)
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        self.addAsyncCleanup(self.client.aclose)

    async def call(self, method, path, uid=None, **options):
        headers = options.pop("headers", {})
        if uid is not None:
            headers = {**headers, "Authorization": f"Bearer fixture-{uid}"}
        return await self.client.request(method, path, headers=headers, **options)

    def status(self, response, expected):
        self.assertEqual(response.status_code, expected, response.text[:500])
        return response.json()

    async def test_private_tooldrop_routes_and_public_projection(self):
        handoff = f"/api/diy/handoff/rentals/{self.rental_id}"
        rentals = "/api/diy/rental-requests/owner/owner"
        messages = f"/api/diy/rental-messages/{self.rental_id}?actor_id=borrower&role=borrower"
        listing = f"/api/diy/listings/{self.listing_id}"
        for method, path, payload in (
            ("GET", handoff, {}),
            ("GET", rentals, {}),
            ("DELETE", listing + "?owner_id=owner", {}),
            ("GET", messages, {}),
            ("PATCH", self.rental_url + "/pickup/owner?owner_id=owner", {"json": {}}),
            ("GET", self.rental_url + "/extension-availability?renter_id=borrower", {}),
        ):
            with self.subTest(method=method, path=path):
                self.status(await self.call(method, path, **payload), 401)
                self.status(await self.call(method, path, "other", **payload), 403)
        public = self.status(await self.call("GET", listing), 200)
        self.assertNotIn("pickup_address", public["listing"])
        self.assertEqual(self.status(await self.call("GET", handoff, "borrower"), 200)["pickup_address"],
                         "Fixture Address")
        self.status(await self.call("GET", rentals, "owner"), 200)
        self.status(await self.call("PUT", listing + "?owner_id=owner", "owner",
                                    json={"description": "Updated by the owner"}), 200)
        message = self.status(await self.call("POST", messages, "borrower", json={"body": "On my way"}), 200)
        self.assertEqual(message["sender_id"], "borrower")
        notes = self.status(await self.call("GET", "/api/notifications/owner", "owner"), 200)
        self.assertEqual(notes[0]["destination"], f"/myTools?rental={self.rental_id}")

    async def test_qr_limits_replay_and_confirm_preserves_photo(self):
        issue = self.rental_url + "/qr-session"
        claim = {"actor_id": "owner", "stage": "pickup_owner"}
        self.status(await self.call("POST", issue, json=claim), 401)
        self.status(await self.call("POST", issue, "borrower", json=claim), 403)
        self.status(await self.call("POST", issue, "owner",
                                    json={**claim, "stage": "return_owner"}), 409)
        old = self.status(await self.call("POST", issue, "owner", json=claim), 200)["token"]
        token = self.status(await self.call("POST", issue, "owner", json=claim), 200)["token"]
        base = "/api/diy/qr-session/"
        qr = base + token
        self.status(await self.call("GET", base + old), 404)
        self.assertEqual(self.status(await self.call("GET", qr), 200)["status"], "pending")
        self.status(await self.call("POST", qr + "/complete",
                                    content=b"x" * (routes_diy.MAX_QR_REQUEST_BYTES + 1)), 413)
        self.status(await self.call("POST", qr + "/complete",
                                    json={"photo_url": "data:image/jpeg;base64,aW52YWxpZA=="}), 400)
        photo = jpeg()
        attempts = await asyncio.gather(*[
            self.call("POST", qr + "/complete", json={"photo_url": photo}) for _ in range(2)
        ])
        self.assertEqual(sorted(result.status_code for result in attempts), [200, 409])
        completed = self.status(await self.call("GET", qr), 200)
        self.assertEqual(completed["status"], "completed")
        self.assertNotIn("photo_url", completed)

        confirmation = self.rental_url + "/pickup/owner?owner_id=owner"
        rental = self.status(await self.call("PATCH", confirmation, "owner",
                                            json={"photo_url": "https://example.com/alternate.jpg",
                                                  "condition_notes": "$looks good"}), 200)["request"]
        self.assertEqual(rental["pickup_owner_evidence"]["photo_url"], photo)
        self.assertEqual(rental["pickup_owner_evidence"]["notes"], "$looks good")
        self.assertNotIn("qr_uploads", rental)
        stored = self.db["tool_rental_requests"].documents[0]
        stored["qr_uploads"]["pickup_owner"]["expires_at"] = "2000-01-01T00:00:00+00:00"
        self.status(await self.call("GET", qr), 410)
        self.status(await self.call("POST", qr + "/complete", json={"photo_url": photo}), 410)

    async def test_qr_return_and_cancelled_session(self):
        rental = self.db["tool_rental_requests"].documents[0]
        rental["status"] = "active"
        issue = self.rental_url + "/qr-session"
        claim = {"actor_id": "borrower", "stage": "return_borrower"}
        result = self.status(await self.call("POST", issue, "borrower", json=claim), 200)
        rental["status"] = "cancelled"
        qr = f"/api/diy/qr-session/{result['token']}/complete"
        self.status(await self.call("POST", qr, json={"photo_url": jpeg()}), 409)
        self.assertNotIn("return_borrower_evidence", rental)

        rental["status"] = "active"
        result = self.status(await self.call("POST", issue, "borrower", json=claim), 200)
        qr = f"/api/diy/qr-session/{result['token']}/complete"
        photo = jpeg()
        self.status(await self.call("POST", qr, json={"photo_url": photo}), 200)
        returned = self.status(await self.call("PATCH", self.rental_url + "/return/borrower?renter_id=borrower",
                                              "borrower", json={}), 200)["request"]
        self.assertEqual(returned["return_borrower_evidence"]["photo_url"], photo)

    async def test_booking_another_users_shop_and_shared_history(self):
        url = "/api/service-requests"
        payload = {
            "customer_id": "customer", "customer_name": "Fixture Customer", "mechanic_id": "mechanic",
            "vehicle_id": self.vehicle_id, "service_requested": "Oil Change",
            "appointment_date": (self.today + timedelta(days=7)).isoformat(),
            "appointment_start_time": "10:00", "share_service_history": True,
        }
        self.status(await self.call("POST", url, json=payload), 401)
        self.status(await self.call("POST", url, "other", json=payload), 403)
        self.status(await self.call("POST", "/api/mechanics/register", "other",
                                    json={"owner_id": "mechanic", "shop_name": "Spoof"}), 403)
        created = self.status(await self.call("POST", url, "customer", json=payload), 200)
        request_id = created["request"]["id"]
        thread = f"{url}/{request_id}/messages"
        self.status(await self.call("POST", thread, "other",
                                    json={"actor_id": "mechanic", "view": "mechanic", "body": "Spoof"}), 403)
        self.status(await self.call("POST", thread, "customer",
                                    json={"actor_id": "customer", "view": "customer", "body": "Hello"}), 200)
        shared = f"{url}/{request_id}/shared-history?mechanic_id=mechanic"
        self.status(await self.call("GET", shared, "other"), 403)
        self.status(await self.call("GET", shared, "mechanic"), 200)
        self.status(await self.call("PATCH", f"{url}/{request_id}/status", "mechanic",
                                    json={"mechanic_id": "mechanic", "status": "accepted"}), 200)

    async def test_garage_questionnaire_save_and_predictions(self):
        profile = {
            "climate_condition": "Extreme Cold",
            "primary_usage": "Heavy Towing",
            "recent_major_service": "Last 12 Months",
        }
        self.status(await self.call("PATCH", self.vehicle_url, json=profile), 401)
        self.status(await self.call("PATCH", self.vehicle_url, "other", json=profile), 404)
        saved = self.status(await self.call("PATCH", self.vehicle_url, "customer", json=profile), 200)
        for field, value in profile.items():
            self.assertEqual(saved["vehicle_details"][field], value)

        service_history = f"/api/service-history/vehicle/{self.vehicle_id}?owner_id=customer"
        self.status(await self.call("GET", service_history), 401)
        self.status(await self.call("GET", service_history, "other"), 403)
        self.status(await self.call("POST", "/api/service-history/", "customer", json={
            "owner_id": "customer", "vehicle_id": self.vehicle_id, "title": "Oil change",
            "service_date": self.today.isoformat(), "mileage": 90000,
        }), 200)
        self.assertEqual(self.status(await self.call("GET", service_history, "customer"), 200)["total"], 1)

        url = f"/api/predict/vehicle/{self.vehicle_id}"
        self.status(await self.call("GET", url + "?owner_id=customer", "other"), 403)
        self.status(await self.call("POST", url, "customer", json={"owner_id": "customer"}), 200)
        result = self.status(await self.call("GET", url + "?owner_id=customer", "customer"), 200)
        for field, value in profile.items():
            self.assertEqual(result["model_profile"][field], value)

    async def test_readiness_cors_and_invalid_token(self):
        status = self.status(await self.call("GET", "/ready"), 200)
        self.assertTrue(status["prediction_model"]["loaded"])
        with patch.object(db_instance, "db", None):
            self.status(await self.call("GET", "/ready"), 503)
        cpu_model.load_production_weights.cache_clear()
        try:
            with patch.object(cpu_model, "WEIGHTS_PATH", Path("/missing/motormate.npz")):
                failed = self.status(await self.call("GET", "/ready"), 503)
                self.assertFalse(failed["prediction_model"]["loaded"])
        finally:
            cpu_model.load_production_weights.cache_clear()
        self.status(await self.call("GET", "/api/notifications/customer",
                                    headers={"Authorization": "Bearer invalid"}), 401)
        preflight = await self.call("OPTIONS", self.vehicle_url, headers={
            "Origin": "http://localhost:3000", "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "authorization",
        })
        self.assertEqual(preflight.status_code, 200)
        self.assertEqual(preflight.headers["Access-Control-Allow-Origin"], "http://localhost:3000")
