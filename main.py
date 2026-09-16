from fastapi import FastAPI
from app.core.database import connect_to_mongo, close_mongo_connection

app = FastAPI(title = "Vehicle Maintaince Predictor")

@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

@app.get("/")
async def root():
    return{"Status": "Success", "message": "Backend is running and connected"}