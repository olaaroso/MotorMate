import os
import sys

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
MODEL_VERSION = "maintenance-mlp-v2"

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

async def predict_maintenance(
        make: str,
        model_name: str,
        year: int,
        mileage: int,
        driving_habits: str = "City Commute",
        climate_condition: str = "Moderate",
        primary_usage: str = "Daily Commuting",
        recent_major_service: str = "Not Sure",
) -> dict:
    """Run a single forward pass for the vehicle prediction model."""
    model = load_latest_model()

    if model is None:
        return {"status": "error", "message": "Prediction model is currently unavailable."}

    safe_year = year if year else 2010
    normalized_year = (safe_year - 2000) / 30.0
    normalized_mileage = mileage / 250000.0

    usage_severity = {
        "City Commute": 0.0,
        "Highway": 0.1,
        "Mixed": 0.35,
        "Severe / Towing": 0.8,
    }.get(driving_habits, 0.0)

    climate_score = {
        "Moderate": 0.0,
        "Coastal": 0.3,
        "Extreme Heat": 0.6,
        "Extreme Cold": 0.8,
    }.get(climate_condition, 0.0)

    primary_usage_score = {
        "Weekend Cruiser": -0.2,
        "Daily Commuting": 0.0,
        "Rideshare": 0.6,
        "Heavy Towing": 0.8,
    }.get(primary_usage, 0.0)

    service_recency_score = {
        "Last 3 Months": -0.4,
        "Last 12 Months": -0.1,
        "Not Sure": 0.2,
        "Over 2 Years Ago": 0.6,
    }.get(recent_major_service, 0.2)

    features = [
        normalized_year,
        normalized_mileage,
        usage_severity,
        climate_score,
        primary_usage_score,
        service_recency_score
    ]

    input_dimension = next(
        (layer.in_features for layer in model.modules() if isinstance(layer, torch.nn.Linear)),
        len(features),
    )
    input_tensor = torch.tensor([features[:input_dimension]], dtype=torch.float32)

    try:
        with torch.no_grad():
            logits = model(input_tensor)
            probabilities = torch.sigmoid(logits).flatten().tolist()
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
            predicted_failures.append({
                "part": parts_map[idx]["part"],
                "probability": round(prob, 2),
                "estimated_cost": parts_map[idx]["cost"],
            })


    if mileage > 60000:
        spark_prob = 0.4 + (normalized_mileage * 0.4) + service_recency_score
        if spark_prob > prediction_threshold:
            predicted_failures.append({"part": "Spark Plugs", "probability": round(min(spark_prob, 0.95), 2), "estimated_cost": 120})

    if climate_condition in ["Extreme Heat", "Extreme Cold"]:
        alt_prob = 0.45 + (climate_score * 0.5)
        if alt_prob > prediction_threshold:
            predicted_failures.append({"part": "Alternator", "probability": round(min(alt_prob, 0.92), 2), "estimated_cost": 450})

    if primary_usage in ["Heavy Towing", "Rideshare"]:
        trans_prob = 0.5 + (primary_usage_score * 0.6)
        if trans_prob > prediction_threshold:
            predicted_failures.append({"part": "Transmission Fluid Flush", "probability": round(min(trans_prob, 0.89), 2), "estimated_cost": 180})

    if mileage > 80000 and primary_usage != "Weekend Cruiser":
        susp_prob = 0.4 + (normalized_mileage * 0.5) + (usage_severity * 0.3)
        if susp_prob > prediction_threshold:
            predicted_failures.append({"part": "Suspension Struts", "probability": round(min(susp_prob, 0.94), 2), "estimated_cost": 600})

    predicted_failures.sort(key=lambda x: x["probability"], reverse=True)

    if not predicted_failures:
        predicted_failures.append({"part": "None expected soon", "probability": 1.0, "estimated_cost": 0})

    return {
        "status": "success",
        "model_version": MODEL_VERSION if input_dimension >= 3 else "maintenance-mlp-v1",
        "predictions": predicted_failures,
    }

def get_model_cache_size() -> int:
    return 1 if predictor_model is not None else 0