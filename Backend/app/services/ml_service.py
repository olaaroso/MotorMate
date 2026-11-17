import logging
from zipfile import BadZipFile

import numpy as np

from app.ml_pipeline.cpu_model import MODEL_VERSION, cpu_logits, load_production_weights

logger = logging.getLogger("vehicle_api")


def model_ready() -> bool:
    try:
        load_production_weights()
        return True
    except (OSError, ValueError, TypeError, AttributeError, BadZipFile, EOFError):
        logger.error("Could not load the versioned maintenance model.")
        return False


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
    if not model_ready():
        return {"status": "error", "message": "Prediction model is currently unavailable."}

    weights = load_production_weights()

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

    try:
        features = np.asarray([normalized_year, normalized_mileage], dtype=np.float32)
        logits = cpu_logits(weights, features)
        probabilities = np.exp(-np.logaddexp(np.float32(0), -logits)).tolist()
    except (ValueError, FloatingPointError, OverflowError):
        logger.exception("Maintenance inference failed.")
        return {"status": "error", "message": "Inference failed."}

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
        "model_version": MODEL_VERSION,
        "predictions": predicted_failures,
    }

def get_model_cache_size() -> int:
    return load_production_weights.cache_info().currsize
