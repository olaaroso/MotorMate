import pytest
from unittest.mock import AsyncMock
from bson import ObjectId
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.api.routes_predict import create_vehicle_prediction
from app.services.vin_service import vin_decoder

@pytest.mark.asyncio
async def test_ml_prediction_route(mocker):
    # 1. Mock the NHTSA API so the test runs instantly and reliably
    mock_vehicle_data = {
        "Make": "HONDA",
        "Model": "ACCORD",
        "ModelYear": "2010",
        "ErrorCode": "0"
    }
    mocker.patch.object(vin_decoder, 'get_basic_info', return_value=mock_vehicle_data)

    # 2. Define a payload for an older, high-mileage car
    # Our PyTorch model should flag a car with 125,000 miles for some repairs
    payload = {
        "vin": "1HGCM82633A000000",
        "mileage": 125000
    }

    # 3. Hit the FastAPI prediction endpoint
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/predict/", json=payload)

    # 4. Assertions
    assert response.status_code == 200
    data = response.json()
    
    assert "vehicle" in data
    assert data["mileage_analyzed"] == 125000
    assert "upcoming_repairs" in data
    assert isinstance(data["upcoming_repairs"], list)
    
    # Print the network's actual predictions to the console so we can verify them
    print(f"\n--- PYTORCH PREDICTIONS FOR 125k MILES ---")
    for repair in data["upcoming_repairs"]:
        print(f"Part: {repair['part']} | Prob: {repair['probability']} | Cost: ${repair['estimated_cost']}")
    print("------------------------------------------")


@pytest.mark.asyncio
async def test_vehicle_prediction_is_saved_for_frontend(mocker):
    vehicle_id = "64f1a2b3c9e78a0012345678"
    object_id = ObjectId(vehicle_id)
    collection = mocker.Mock()
    collection.update_one = AsyncMock()
    vehicle = {
        "_id": object_id,
        "owner_id": "owner-1",
        "make": "Honda",
        "model": "Accord",
        "year": 2015,
    }
    repairs = [{"part": "Brake Pads", "probability": 0.82, "estimated_cost": 250}]
    mocker.patch(
        "app.api.routes_predict.predict_maintenance",
        new=AsyncMock(
            return_value={
                "status": "success",
                "model_version": "maintenance-mlp-v2",
                "predictions": repairs,
            }
        ),
    )

    result = await create_vehicle_prediction(
        vehicle=vehicle,
        mileage=80000,
        make="Honda",
        model_name="Accord",
        year=2015,
        driving_habits="Mixed",
        vehicles_collection=collection,
    )

    assert result["vehicle_id"] == vehicle_id
    assert result["prediction"]["upcoming_repairs"] == repairs
    collection.update_one.assert_awaited_once()
    update = collection.update_one.await_args.args[1]["$set"]
    assert update["maintenance_model_profile"]["vehicle_id"] == vehicle_id
    assert update["maintenance_prediction"]["mileage"] == 80000