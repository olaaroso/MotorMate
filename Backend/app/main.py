import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from app.api import routes_auth, routes_mechanic, routes_predict, routes_vin
from app.core.database import close_mongo_connection, connect_to_mongo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("vehicle_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    logger.info("Application startup complete")
    yield
    await close_mongo_connection()
    logger.info("Application shutdown complete")


app = FastAPI(title="Vehicle Maintenance Predictor", lifespan=lifespan)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("Request %s %s", request.method, request.url.path)
    response = await call_next(request)
    logger.info("Response %s for %s", response.status_code, request.url.path)
    return response


app.include_router(routes_auth.router)
app.include_router(routes_vin.router)
app.include_router(routes_predict.router)
app.include_router(routes_mechanic.router)


@app.get("/")
async def root():
    return {"status": "success", "message": "Backend is running and connected."}


@app.get("/health")
async def health_check():
    from app.core.database import db_instance

    database_status = "connected" if db_instance.db is not None else "disconnected"
    return {
        "status": "ok",
        "service": "Vehicle Maintenance Predictor API",
        "database": database_status,
    }