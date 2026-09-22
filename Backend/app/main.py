from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api import routes_vin, routes_predict, routes_mechanic

# FIX: Use the lifespan context manager for startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    await connect_to_mongo()
    yield
    # Shutdown logic
    await close_mongo_connection()

app = FastAPI(title="Vehicle Maintenance Predictor", lifespan=lifespan)

app.include_router(routes_vin.router)
app.include_router(routes_predict.router)
app.include_router(routes_mechanic.router)

@app.get("/")
async def root():
    return {"status": "success", "message": "Backend is running and connected."}