import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

from app.core.config import settings


class Database:
    client: AsyncIOMotorClient = None
    db = None


db_instance = Database()
logger = logging.getLogger("vehicle_api")


async def mongo_ready() -> bool:
    if db_instance.db is None:
        return False
    try:
        async with asyncio.timeout(2):
            await db_instance.db.command("ping")
        return True
    except (TimeoutError, PyMongoError):
        return False


async def connect_to_mongo():
    try:
        db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
        db_instance.db = db_instance.client[settings.DATABASE_NAME]
    except (PyMongoError, ValueError):
        await close_mongo_connection()
        logger.error("MongoDB configuration is invalid.")
        return
    if await mongo_ready():
        logger.info("Connected to MongoDB database %s.", settings.DATABASE_NAME)
    else:
        logger.warning("MongoDB is unavailable. The driver will retry on subsequent requests.")


async def close_mongo_connection():
    if db_instance.client is not None:
        db_instance.client.close()
    db_instance.client = None
    db_instance.db = None
