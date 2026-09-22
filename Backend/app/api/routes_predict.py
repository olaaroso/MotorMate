from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.vin_service import vin_decoder
from app.services.ml_service import predict_maintenance

router = APIRouter(prefix="/api/predict", tags=["Repair Predictions"])

class PredictionRequest(BaseModel):
    vin: str
    mileage: int

@router.post("/")
async def get_prediction(request: PredictionRequest):
    if len(request.vin) != 17:
        raise HTTPException(status_code=400, detail="Invalid VIN length")
        
    # 1. Decode the VIN
    vehicle_data = await vin_decoder.get_basic_info(request.vin)
    if "error" in vehicle_data or vehicle_data.get("ErrorCode") not in ["0", "1"]:
        raise HTTPException(status_code=400, detail="Failed to decode VIN")
        
    # 2. Safely extract the year for the neural network
    try:
        year = int(vehicle_data.get("ModelYear"))
    except (ValueError, TypeError):
        year = 2010
        
    # 3. Feed the data into the ML Model
    prediction_results = await predict_maintenance(
        make=vehicle_data.get("Make", "Unknown"),
        model_name=vehicle_data.get("Model", "Unknown"),
        year=year,
        mileage=request.mileage
    )
    
    if prediction_results["status"] == "error":
        raise HTTPException(status_code=500, detail="Inference failed")

    return {
        "vehicle": vehicle_data,
        "mileage_analyzed": request.mileage,
        "upcoming_repairs": prediction_results["predictions"]
    }