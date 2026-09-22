import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
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