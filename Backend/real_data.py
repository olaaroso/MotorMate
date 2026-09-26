import asyncio
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


async def upsert_sample(collection, query: dict, document: dict, label: str) -> None:
    result = await collection.update_one(query, {"$setOnInsert": document}, upsert=True)
    action = "inserted" if result.upserted_id else "already exists"
    print(f"{label}: {action}")


async def seed_real_data() -> None:
    client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=10000,
    )
    try:
        database = client[settings.DATABASE_NAME]
        await database.command("ping")
        print(f"Connected to MongoDB database: {settings.DATABASE_NAME}")

        users = database["users"]
        sample_users = [
            {
                "name": "Sample Customer",
                "email": "sample.customer@example.com",
                "role": "consumer",
                "created_at": datetime.now(timezone.utc),
            },
            {
                "name": "Sample Renter",
                "email": "sample.renter@example.com",
                "role": "diy_peer",
                "tools_available": ["OBD-II scanner"],
                "zip_code": "11735",
                "willing_to_assist": True,
                "price_to_rent": 15.0,
                "price_to_buy": 45.0,
                "created_at": datetime.now(timezone.utc),
            },
            {
                "name": "Sample Mechanic",
                "email": "sample.mechanic@example.com",
                "role": "mechanic",
                "created_at": datetime.now(timezone.utc),
            },
        ]

        for user in sample_users:
            await upsert_sample(users, {"email": user["email"]}, user, user["role"])

        customer = await users.find_one({"email": "sample.customer@example.com"})
        mechanic_profile = {
            "name": "Sample Mechanic",
            "email": "sample.mechanic@example.com",
            "role": "mechanic",
            "shop_name": "Sample Auto Repair",
            "address": "123 Main Street, Farmingdale, NY 11735",
            "services_offered": ["Brake Pads"],
            "price_per_hour": 95.0,
            "rating": 5.0,
            "created_at": datetime.now(timezone.utc),
        }
        await upsert_sample(
            database["mechanics"],
            {"email": mechanic_profile["email"]},
            mechanic_profile,
            "mechanic profile",
        )

        vehicle = {
            "owner_id": str(customer["_id"]),
            "vin": "1HGBH41JXMN109186",
            "make": "Honda",
            "model": "Accord",
            "year": 2020,
            "current_mileage": 42000,
            "maintenance_history": [],
        }
        await upsert_sample(
            database["vehicles"],
            {"vin": vehicle["vin"], "owner_id": vehicle["owner_id"]},
            vehicle,
            "vehicle",
        )
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(seed_real_data())