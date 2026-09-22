import os
import sys
import torch
import mlflow
from mlflow.tracking import MlflowClient

# 1. Path Resolution: Dynamically find our directories
current_dir = os.path.dirname(os.path.abspath(__file__))  # .../Backend/app/services
app_dir = os.path.dirname(current_dir)                    # .../Backend/app
backend_root = os.path.dirname(app_dir)                   # .../Backend/
ml_pipeline_dir = os.path.join(app_dir, "ml_pipeline")    # .../Backend/app/ml_pipeline

# 2. Fix Unpickling Error: Tell Python where to find train.py
if ml_pipeline_dir not in sys.path:
    sys.path.append(ml_pipeline_dir)

# Cache the model in memory
predictor_model = None

def load_latest_model():
    """
    Connects to the local MLflow SQLite database, finds the most recent
    training run, and loads that PyTorch model into memory.
    """
    global predictor_model
    if predictor_model is not None:
        return predictor_model

    # Force the absolute path to the SQLite database
    db_path = os.path.join(backend_root, "mlflow.db")
    mlflow.set_tracking_uri(f"sqlite:///{db_path}")

    try:
        experiment = mlflow.get_experiment_by_name("Vehicle_Maintenance_Prediction")
        if not experiment:
            print("Warning: MLflow experiment not found. Model not loaded.")
            return None

        # Fetch the most recent run from the experiment
        client = MlflowClient()
        runs = client.search_runs(
            experiment_ids=[experiment.experiment_id],
            order_by=["start_time DESC"],
            max_results=1
        )
        
        if not runs:
            print("Warning: No MLflow runs found.")
            return None

        latest_run_id = runs[0].info.run_id
        model_uri = f"runs:/{latest_run_id}/maintenance_model"
        
        print(f"Loading PyTorch model from MLflow Run ID: {latest_run_id}")
        predictor_model = mlflow.pytorch.load_model(model_uri)
        
        # Ensure the model is locked into evaluation mode
        predictor_model.eval() 
        
        return predictor_model
    except Exception as e:
        print(f"Failed to load MLflow model: {e}")
        return None

async def predict_maintenance(make: str, model_name: str, year: int, mileage: int) -> dict:
    """
    Normalizes the vehicle data, runs it through the loaded PyTorch model,
    and returns formatted probability predictions.
    """
    model = load_latest_model()
    
    if model is None:
        return {"status": "error", "message": "Prediction model is currently unavailable."}

    # Normalize the inputs
    safe_year = year if year else 2010
    normalized_year = (safe_year - 2000) / 30.0
    normalized_mileage = mileage / 250000.0

    # Create the tensor shape: [batch_size=1, features=2]
    input_tensor = torch.tensor([[normalized_year, normalized_mileage]], dtype=torch.float32)

    # Run Inference
    try:
        with torch.no_grad():
            logits = model(input_tensor)
            probabilities = torch.sigmoid(logits).squeeze().tolist()
    except Exception as e:
        return {"status": "error", "message": f"Inference failed: {str(e)}"}

    parts_map = [
        {"part": "Brake Pads", "cost": 250},
        {"part": "Timing Belt", "cost": 800},
        {"part": "Battery", "cost": 150}
    ]

    predicted_failures = []
    prediction_threshold = 0.50

    for idx, prob in enumerate(probabilities):
        if prob > prediction_threshold:
            predicted_failures.append({
                "part": parts_map[idx]["part"],
                "probability": round(prob, 2),
                "estimated_cost": parts_map[idx]["cost"]
            })

    if not predicted_failures:
        predicted_failures.append({
            "part": "None expected soon", 
            "probability": 1.0, 
            "estimated_cost": 0
        })

    return {
        "status": "success",
        "predictions": predicted_failures
    }