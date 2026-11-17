"""Rebuild and compare the release weights against the pinned PyTorch checkpoint."""

import hashlib
import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.ml_pipeline.cpu_model import (
    ARCHITECTURE,
    BATCH_NORM_EPSILON,
    INPUT_ORDER,
    MODEL_VERSION,
    SOURCE_MODEL_ID,
    SOURCE_SHA256,
    WEIGHT_SHAPES,
    WEIGHTS_PATH,
    cpu_logits,
)

CHECKPOINT = BACKEND / "mlruns" / "1" / "models" / SOURCE_MODEL_ID / "artifacts" / "data" / "model.pth"


def write_release(weights, verify):
    if {name: array.shape for name, array in weights.items()} != WEIGHT_SHAPES:
        raise ValueError("Unexpected checkpoint tensor shapes.")
    WEIGHTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=WEIGHTS_PATH.parent) as directory:
        archive = Path(directory) / WEIGHTS_PATH.name
        np.savez_compressed(archive, **weights)
        with np.load(archive, allow_pickle=False) as stored:
            actual = dict(stored)
            for name, array in weights.items():
                np.testing.assert_array_equal(array, actual[name])
        verify(actual)
        manifest = archive.with_suffix(".json")
        manifest.write_text(json.dumps({
            "model_version": MODEL_VERSION,
            "source_model_id": SOURCE_MODEL_ID,
            "source_sha256": SOURCE_SHA256,
            "architecture": ARCHITECTURE,
            "input_order": INPUT_ORDER,
            "batch_norm_epsilon": BATCH_NORM_EPSILON,
            "weights_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        }, indent=2) + "\n", encoding="utf-8")
        archive.replace(WEIGHTS_PATH)
        manifest.replace(WEIGHTS_PATH.with_suffix(".json"))


def main():
    import torch
    from torch import nn

    from app.ml_pipeline.train import MaintenancePredictor

    if hashlib.sha256(CHECKPOINT.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise SystemExit("The source checkpoint differs from the audited model.")
    # The artifact records the old training module name. Restrict the permitted
    # objects to the original model and its known PyTorch layers.
    with torch.serialization.safe_globals([
        (MaintenancePredictor, "train.MaintenancePredictor"),
        nn.Sequential, nn.Linear, nn.ReLU, nn.BatchNorm1d, nn.Dropout,
    ]):
        legacy = torch.load(CHECKPOINT, map_location="cpu", weights_only=True).eval()
    if (legacy.network[0].in_features != ARCHITECTURE[0]
            or legacy.network[2].eps != BATCH_NORM_EPSILON):
        raise ValueError("Checkpoint architecture differs from the release.")

    state = legacy.state_dict()
    weights = {name: state[name].detach().cpu().numpy() for name in WEIGHT_SHAPES}
    features = np.asarray([
        ((year - 2000) / 30, mileage / 250000)
        for year in range(1995, 2041, 3)
        for mileage in range(0, 350001, 25000)
    ], dtype=np.float32)
    with torch.inference_mode():
        expected = legacy(torch.from_numpy(features))
        expected_probabilities = torch.sigmoid(expected).numpy()
        expected_logits = expected.numpy()

    def verify(exported):
        actual = cpu_logits(exported, features)
        np.testing.assert_allclose(actual, expected_logits, rtol=2e-5, atol=2e-5)
        probabilities = np.exp(-np.logaddexp(np.float32(0), -actual))
        np.testing.assert_allclose(probabilities, expected_probabilities, rtol=2e-5, atol=2e-6)

    write_release(weights, verify)
    print(f"Verified {len(features)} vectors against PyTorch and exported {WEIGHTS_PATH.name}.")


if __name__ == "__main__":
    main()
