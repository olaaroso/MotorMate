"""Versioned CPU inference for the committed two-feature maintenance model."""

import hashlib
import json
from functools import lru_cache
from io import BytesIO
from pathlib import Path

import numpy as np

MODEL_VERSION = "maintenance-mlp-v1"
WEIGHTS_PATH = Path(__file__).resolve().parent / "models" / f"{MODEL_VERSION}.npz"
SOURCE_MODEL_ID = "m-b8ed1a0533814672a5fd2db37125928d"
SOURCE_SHA256 = "2a74c50d115d2248156d5ab0dce2d4cc4b70c4a7e623482d763c2f2605fd50f5"
ARCHITECTURE = [2, 64, 32, 3]
BATCH_NORM_EPSILON = 1e-5
INPUT_ORDER = ["normalized_year", "normalized_mileage"]
WEIGHT_SHAPES = {
    "network.0.weight": (64, 2),
    "network.0.bias": (64,),
    "network.2.weight": (64,),
    "network.2.bias": (64,),
    "network.2.running_mean": (64,),
    "network.2.running_var": (64,),
    "network.4.weight": (32, 64),
    "network.4.bias": (32,),
    "network.6.weight": (3, 32),
    "network.6.bias": (3,),
}


@lru_cache(maxsize=1)
def load_production_weights() -> dict[str, np.ndarray]:
    metadata = json.loads(WEIGHTS_PATH.with_suffix(".json").read_text(encoding="utf-8"))
    raw = WEIGHTS_PATH.read_bytes()
    if (metadata.get("model_version") != MODEL_VERSION
            or metadata.get("source_sha256") != SOURCE_SHA256
            or metadata.get("architecture") != ARCHITECTURE
            or metadata.get("input_order") != INPUT_ORDER
            or metadata.get("batch_norm_epsilon") != BATCH_NORM_EPSILON
            or metadata.get("weights_sha256") != hashlib.sha256(raw).hexdigest()):
        raise ValueError("Maintenance weights do not match the release manifest.")

    with np.load(BytesIO(raw), allow_pickle=False) as archive:
        if set(archive.files) != set(WEIGHT_SHAPES):
            raise ValueError("Unexpected maintenance weights.")
        weights = {}
        for name, shape in WEIGHT_SHAPES.items():
            array = archive[name]
            if (array.dtype != np.dtype("float32") or array.shape != shape
                    or not np.isfinite(array).all()):
                raise ValueError(f"Invalid maintenance weight: {name}.")
            array.flags.writeable = False
            weights[name] = array
    if (weights["network.2.running_var"] < 0).any():
        raise ValueError("Invalid maintenance batch-normalization variance.")
    return weights


def cpu_logits(weights: dict[str, np.ndarray], features: np.ndarray) -> np.ndarray:
    hidden = np.maximum(features @ weights["network.0.weight"].T + weights["network.0.bias"], 0)
    # Evaluation uses the stored batch-normalization statistics and skips dropout.
    variance = weights["network.2.running_var"] + np.float32(BATCH_NORM_EPSILON)
    normalized = (hidden - weights["network.2.running_mean"]) / np.sqrt(variance)
    hidden = normalized * weights["network.2.weight"] + weights["network.2.bias"]
    hidden = np.maximum(hidden @ weights["network.4.weight"].T + weights["network.4.bias"], 0)
    return hidden @ weights["network.6.weight"].T + weights["network.6.bias"]
