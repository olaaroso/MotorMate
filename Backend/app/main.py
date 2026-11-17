import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    routes_auth,
    routes_diy,
    routes_location,
    routes_mechanic,
    routes_notifications,
    routes_predict,
    routes_rental_extensions,
    routes_tool_handoff,
    routes_service_history,
    routes_service_request_messages,
    routes_service_requests,
    routes_vin,
    routes_rental_messages,
)
from app.core.config import settings
from app.core.database import close_mongo_connection, connect_to_mongo, mongo_ready
from app.services.ml_service import MODEL_VERSION, model_ready

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

logger = logging.getLogger("vehicle_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    model_ready()
    logger.info("Application startup complete")

    yield

    await close_mongo_connection()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Vehicle Maintenance Predictor",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(
    request: Request,
    call_next,
):
    path = request.url.path
    qr_link = path.startswith("/api/diy/qr-session/")
    log_path = "/api/diy/qr-session/[token]" if qr_link else path
    logger.info("Request %s %s", request.method, log_path)
    response = await call_next(request)
    if qr_link:
        response.headers["Cache-Control"] = "no-store"
    logger.info("Response %s for %s", response.status_code, log_path)
    return response


app.include_router(routes_auth.router)
app.include_router(routes_vin.router)
app.include_router(routes_predict.router)
app.include_router(routes_mechanic.router)
app.include_router(routes_location.router)
app.include_router(routes_diy.router)
app.include_router(routes_rental_extensions.router)
app.include_router(routes_tool_handoff.router)
app.include_router(routes_service_history.router)
app.include_router(routes_notifications.router,
    prefix="/api/notifications",
    tags=["Notifications"],
)
app.include_router(routes_service_requests.router)
app.include_router(routes_service_request_messages.router)
app.include_router(routes_rental_messages.router)


@app.get("/")
async def root():
    return {
        "status": "success",
        "message": "Backend is running and connected.",
    }


@app.get("/health")
async def health_check():
    database_connected = await mongo_ready()
    model_loaded = model_ready()
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "database": "connected" if database_connected else "disconnected",
        "prediction_model": {"version": MODEL_VERSION, "loaded": model_loaded},
        "ready": database_connected and model_loaded,
    }


@app.get("/ready")
async def readiness_check():
    health = await health_check()
    health["status"] = "ok" if health["ready"] else "unavailable"
    return JSONResponse(health, status_code=200 if health["ready"] else 503)
