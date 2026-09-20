from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from core.database import connect_to_mongo, close_mongo_connection

from app import routes_vin, routes_predict, routes_diy, routes_mechanic


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="AutoPulse & ToolDrop API",
    description="Backend API for vehicle maintenance predictions and peer-to-peer tool rentals",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_vin.router, prefix="/api/v1/vin", tags=["VIN & Specs"])
app.include_router(
    routes_predict.router, prefix="/api/v1/predict", tags=["Maintenance ML"]
)
app.include_router(routes_diy.router, prefix="/api/v1/diy", tags=["ToolDrop"])
app.include_router(
    routes_mechanic.router, prefix="/api/v1/mechanic", tags=["Mechanics"]
)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "Success", "message": "Backend is running and connected"}