from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    # Connects using the Atlas URI from .env
    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL)
    # Selects the specific database to use
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    print(f"Successfully connected to MongoDB Atlas: {settings.DATABASE_NAME}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB Atlas connection")