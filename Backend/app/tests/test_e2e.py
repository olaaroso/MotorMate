import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db_instance, connect_to_mongo, close_mongo_connection

TEST_DATABASE_NAME = "test_capstone_e2e_db"

@pytest.fixture(autouse=True)
async def setup_and_teardown_db():
    # Setup test database
    await connect_to_mongo()
    original_db = db_instance.db
    db_instance.db = db_instance.client[TEST_DATABASE_NAME]
    
    yield 
    
    # Teardown test database
    await db_instance.client.drop_database(TEST_DATABASE_NAME)
    db_instance.db = original_db
    await close_mongo_connection()

@pytest.mark.asyncio
async def test_full_user_journey_live_api():
    """
    End-to-End Test: 
    1. Register a local mechanic.
    2. Register a VIN (Hits the ACTUAL live NHTSA API).
    3. Run ML Inference to predict broken parts.
    4. Search the database for the registered mechanic who fixes that part.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        
        # ==========================================
        # STEP 1: Register a Mechanic in Farmingdale
        # ==========================================
        mechanic_payload = {
            "name": "Jane Doe",
            "email": "jane@capstoneauto.com",
            "role": "mechanic",
            "shop_name": "Capstone Auto Repair",
            "address": "123 Main St, Farmingdale, NY 11735",
            "price_per_hour": 120.0,
            "services_offered": ["Brake Pads", "Timing Belt", "Battery"]
        }
        mech_res = await ac.post("/api/mechanics/register", json=mechanic_payload)
        assert mech_res.status_code == 200
        
        # ==========================================
        # STEP 2: Decode VIN & Save to Database
        # ==========================================
        vin_payload = {
            "vin": "1G1RC6E42CU111111",  # Mathematically valid Chevy Volt VIN
            "owner_id": "student_999"
        }
        vin_res = await ac.post("/api/vin/register", json=vin_payload)
        
        # Print out the error if it fails again so we can debug the exact NHTSA message
        if vin_res.status_code != 200:
            print(f"\nNHTSA API Error: {vin_res.json()}")
            
        assert vin_res.status_code == 200
        
        vehicle_info = vin_res.json()["vehicle_details"]
        print(f"\n\n[1] VEHICLE REGISTERED: {vehicle_info['year']} {vehicle_info['make']} {vehicle_info['model']}")

        # ==========================================
        # STEP 3: PyTorch ML Inference
        # ==========================================
        pred_payload = {
            "vin": "1G1RC6E42CU111111",
            "mileage": 145000  
        }
        pred_res = await ac.post("/api/predict/", json=pred_payload)
        assert pred_res.status_code == 200
        
        pred_data = pred_res.json()
        repairs = pred_data["upcoming_repairs"]
        
        print(f"\n[2] ML PREDICTIONS (145,000 MILES):")
        for r in repairs:
            print(f"    -> {r['part']} ({r['probability']*100:.1f}% risk, Est: ${r['estimated_cost']})")

        # ==========================================
        # STEP 4: Mechanic Matching Algorithm
        # ==========================================
        # Take the top predicted broken part and search the database for it
        if repairs and repairs[0]["part"] != "None expected soon":
            top_repair = repairs[0]["part"]
            
            search_res = await ac.get(
                f"/api/mechanics/search?zip_code=11735&service_needed={top_repair}"
            )
            assert search_res.status_code == 200
            
            search_data = search_res.json()
            print(f"\n[3] MECHANIC MATCH FOR '{top_repair.upper()}':")
            for shop in search_data["results"]:
                print(f"    -> Shop: {shop['shop_name']} | Address: {shop['address']} | Est. Labor: ${shop['estimated_labor_cost']}")
        
        print("\n=== END-TO-END TEST COMPLETE ===")