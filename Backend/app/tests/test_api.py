import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db_instance, connect_to_mongo, close_mongo_connection
from app.services.vin_service import vin_decoder

TEST_DATABASE_NAME = "test_car_repair_db"

@pytest_asyncio.fixture(autouse=True)
async def setup_and_teardown_db():
    # Explicitly open the database connection since httpx does not trigger lifespan events
    await connect_to_mongo()
    
    original_db = db_instance.db
    db_instance.db = db_instance.client[TEST_DATABASE_NAME]
    
    yield 
    
    # Drop the test database and close the connection
    await db_instance.client.drop_database(TEST_DATABASE_NAME)
    db_instance.db = original_db
    await close_mongo_connection()

@pytest.mark.asyncio
async def test_register_and_lookup_vin_success(mocker):
    mock_vehicle_data = {
        "Make": "HONDA",
        "Model": "ACCORD",
        "ModelYear": "2015",
        "ErrorCode": "0"
    }
    mocker.patch.object(vin_decoder, 'get_basic_info', return_value=mock_vehicle_data)

    test_vin = "1HGCM82633A000000"
    test_owner_id = "64f1a2b3c9e78a0012345678"
    payload = {"vin": test_vin, "owner_id": test_owner_id}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/vin/register", json=payload)

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["message"] == "Vehicle successfully decoded and saved"
    
    saved_vehicle = await db_instance.db["vehicles"].find_one({"vin": test_vin})
    assert saved_vehicle is not None