from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


class Database:
    client: AsyncIOMotorClient = None
    db = None


db_instance = Database()


async def connect_to_mongo():
    try:
        db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL)
        db_instance.db = db_instance.client[settings.DATABASE_NAME]
        await db_instance.db.command("ping")
        print(f"Successfully connected to MongoDB: {settings.DATABASE_NAME}")
    except Exception as exc:  # pragma: no cover - defensive startup guard
        db_instance.client = None
        db_instance.db = None
        print(f"MongoDB unavailable at startup: {exc}")


async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")