import os
import sys
from typing import Optional

import mlflow
import torch
from mlflow.tracking import MlflowClient

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
backend_root = os.path.dirname(app_dir)
ml_pipeline_dir = os.path.join(app_dir, "ml_pipeline")

if ml_pipeline_dir not in sys.path:
    sys.path.append(ml_pipeline_dir)

predictor_model = None


def load_latest_model():
    """Load the most recent MLflow model and cache it in memory."""
    global predictor_model
    if predictor_model is not None:
        return predictor_model

    db_path = os.path.join(backend_root, "mlflow.db")
    mlflow.set_tracking_uri(f"sqlite:///{db_path}")

    try:
        experiment = mlflow.get_experiment_by_name("Vehicle_Maintenance_Prediction")
        if not experiment:
            print("Warning: MLflow experiment not found. Model not loaded.")
            return None

        client = MlflowClient()
        runs = client.search_runs(
            experiment_ids=[experiment.experiment_id],
            order_by=["start_time DESC"],
            max_results=1,
        )

        if not runs:
            print("Warning: No MLflow runs found.")
            return None

        latest_run_id = runs[0].info.run_id
        model_uri = f"runs:/{latest_run_id}/maintenance_model"
        predictor_model = mlflow.pytorch.load_model(model_uri)
        predictor_model.eval()
        return predictor_model
    except Exception as exc:
        print(f"Failed to load MLflow model: {exc}")
        return None


async def predict_maintenance(make: str, model_name: str, year: int, mileage: int) -> dict:
    """Run a single forward pass for the vehicle prediction model."""
    model = load_latest_model()

    if model is None:
        return {"status": "error", "message": "Prediction model is currently unavailable."}

    safe_year = year if year else 2010
    normalized_year = (safe_year - 2000) / 30.0
    normalized_mileage = mileage / 250000.0
    input_tensor = torch.tensor([[normalized_year, normalized_mileage]], dtype=torch.float32)

    try:
        with torch.no_grad():
            logits = model(input_tensor)
            probabilities = torch.sigmoid(logits).squeeze().tolist()
    except Exception as exc:
        return {"status": "error", "message": f"Inference failed: {str(exc)}"}

    parts_map = [
        {"part": "Brake Pads", "cost": 250},
        {"part": "Timing Belt", "cost": 800},
        {"part": "Battery", "cost": 150},
    ]

    predicted_failures = []
    prediction_threshold = 0.50

    for idx, prob in enumerate(probabilities):
        if prob > prediction_threshold:
            predicted_failures.append(
                {
                    "part": parts_map[idx]["part"],
                    "probability": round(prob, 2),
                    "estimated_cost": parts_map[idx]["cost"],
                }
            )

    if not predicted_failures:
        predicted_failures.append({"part": "None expected soon", "probability": 1.0, "estimated_cost": 0})

    return {"status": "success", "predictions": predicted_failures}


def get_model_cache_size() -> int:
    """Expose a simple cache health check for observability."""
    return 1 if predictor_model is not None else 0