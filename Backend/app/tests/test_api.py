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
async def test_health_endpoint_returns_service_status():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "Vehicle Maintenance Predictor API"


@pytest.mark.asyncio
async def test_invalid_vin_fails_fast():
    payload = {"vin": "INVALID", "owner_id": "owner-123"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/vin/register", json=payload)

    assert response.status_code == 400
    assert "17 characters" in response.json()["detail"]


@pytest.mark.asyncio
async def test_auth_login_returns_token_for_registered_user():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/api/auth/register",
            json={
                "name": "Auth Tester",
                "email": "auth@example.com",
                "password": "secretpass",
                "role": "mechanic",
            },
        )
        assert response.status_code == 200

        login_response = await ac.post(
            "/api/auth/login",
            json={"email": "auth@example.com", "password": "secretpass"},
        )

    assert login_response.status_code == 200
    assert "access_token" in login_response.json()
    assert login_response.json()["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_mechanic_route_requires_authentication():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/mechanics/search?zip_code=11735&service_needed=Brake%20Pads")

    assert response.status_code == 401


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