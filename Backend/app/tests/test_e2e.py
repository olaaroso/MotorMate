import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import close_mongo_connection, connect_to_mongo, db_instance
from app.main import app

TEST_DATABASE_NAME = os.getenv("MONGOODB_URL", "test_db")


@pytest_asyncio.fixture(autouse=True)
async def setup_and_teardown_db():
    await connect_to_mongo()
    original_db = db_instance.db
    db_instance.db = db_instance.client[TEST_DATABASE_NAME]

    yield

    await db_instance.client.drop_database(TEST_DATABASE_NAME)
    db_instance.db = original_db
    await close_mongo_connection()


@pytest.mark.asyncio
async def test_full_user_journey_live_api():
    """Exercise the full mechanic->VIN->prediction->matching journey against the live app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        auth_res = await ac.post(
            "/api/auth/register",
            json={
                "name": "Jane Doe",
                "email": "jane@capstoneauto.com",
                "password": "secretpass",
                "role": "mechanic",
            },
        )
        assert auth_res.status_code == 200
        token = auth_res.json()["access_token"]

        mechanic_payload = {
            "name": "Jane Doe",
            "email": "jane@capstoneauto.com",
            "role": "mechanic",
            "shop_name": "Capstone Auto Repair",
            "address": "123 Main St, Farmingdale, NY 11735",
            "price_per_hour": 120.0,
            "services_offered": ["Brake Pads", "Timing Belt", "Battery"],
        }
        mech_res = await ac.post(
            "/api/mechanics/register",
            json=mechanic_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert mech_res.status_code == 200

        vin_payload = {
            "vin": "1G1RC6E42CU111111",
            "owner_id": "student_999",
        }
        vin_res = await ac.post("/api/vin/register", json=vin_payload)
        if vin_res.status_code != 200:
            print(f"\nNHTSA API Error: {vin_res.json()}")
        assert vin_res.status_code == 200

        vehicle_info = vin_res.json()["vehicle_details"]
        assert vehicle_info["vin"] == vin_payload["vin"]

        pred_payload = {"vin": "1G1RC6E42CU111111", "mileage": 145000}
        pred_res = await ac.post("/api/predict/", json=pred_payload)
        assert pred_res.status_code == 200

        pred_data = pred_res.json()
        repairs = pred_data["upcoming_repairs"]
        assert isinstance(repairs, list)

        if repairs and repairs[0]["part"] != "None expected soon":
            top_repair = repairs[0]["part"]
            search_res = await ac.get(
                f"/api/mechanics/search?zip_code=11735&service_needed={top_repair}",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert search_res.status_code == 200
            search_data = search_res.json()
            assert isinstance(search_data["results"], list)

        print("\n=== END-TO-END TEST COMPLETE ===")