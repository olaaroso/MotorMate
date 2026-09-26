import os

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_real_integration_smoke_with_live_nhtsa_api():
    """Exercise the real VIN decode path and keep the app contract stable for live API integration."""
    if not os.getenv("RUN_LIVE_INTEGRATION_TESTS"):
        pytest.skip("Live integration tests are opt-in; set RUN_LIVE_INTEGRATION_TESTS=1 to enable them.")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        mechanic_payload = {
            "name": "Live Test Mechanic",
            "email": "live@example.com",
            "role": "mechanic",
            "shop_name": "Live Integration Shop",
            "address": "123 Main St, Farmingdale, NY 11735",
            "price_per_hour": 110.0,
            "services_offered": ["Brake Pads", "Timing Belt", "Battery"],
        }
        mechanic_response = await client.post("/api/mechanics/register", json=mechanic_payload)
        assert mechanic_response.status_code == 200

        vin_payload = {"vin": "1G1RC6E42CU111111", "owner_id": "live-owner-1"}
        vin_response = await client.post("/api/vin/register", json=vin_payload)
        assert vin_response.status_code == 200
        vehicle = vin_response.json()["vehicle_details"]
        assert vehicle["vin"] == vin_payload["vin"]

        prediction = await client.post("/api/predict/", json={"vin": vin_payload["vin"], "mileage": 145000})
        assert prediction.status_code == 200
        body = prediction.json()
        assert "upcoming_repairs" in body

        if body["upcoming_repairs"] and body["upcoming_repairs"][0]["part"] != "None expected soon":
            service = body["upcoming_repairs"][0]["part"]
            matches = await client.get(f"/api/mechanics/search?zip_code=11735&service_needed={service}")
            assert matches.status_code == 200
            assert isinstance(matches.json()["results"], list)