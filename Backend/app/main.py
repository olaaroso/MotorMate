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

# TODO: Add a health check endpoint that verifies the connection to the MongoDB database and returns the status of the application.
# TODO: Implement logging for all API requests and responses to facilitate debugging and monitoring of the application.
# TODO: Build the bridge between the ML model and the API to allow for real-time predictions based on user input.
# TODO: Build the bridge between the frontend and the API to allow for seamless user interactions and data flow between the two components.
# TODO: Implement authentication and authorization mechanisms to secure the API endpoints and protect sensitive user data.