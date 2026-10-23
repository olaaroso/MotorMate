from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


class MaintenancePredictor(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super(MaintenancePredictor, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_dim),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, output_dim),
        )

    def forward(self, x):
        return self.network(x)


def generate_synthetic_data(num_samples=20000, seed=42):
    """Generate repeatable maintenance examples across mileage and usage."""
    print(f"Generating {num_samples} synthetic vehicle records...")

    rng = np.random.default_rng(seed)
    years = rng.integers(2005, 2026, size=(num_samples, 1))
    normalized_years = (years - 2000) / 30.0

    mileages = rng.integers(10000, 250001, size=(num_samples, 1))
    normalized_mileages = mileages / 250000.0
    usage_severity = rng.uniform(0.0, 1.0, size=(num_samples, 1))

    X = np.hstack((normalized_years, normalized_mileages, usage_severity))

    brake_threshold = 65000 - usage_severity * 25000
    timing_threshold = 125000 - usage_severity * 20000
    vehicle_age = 2026 - years
    brake_probability = 1 / (1 + np.exp(-(mileages - brake_threshold) / 14000))
    timing_probability = 1 / (1 + np.exp(-(mileages - timing_threshold) / 18000))
    battery_probability = 1 / (1 + np.exp(-(vehicle_age - 6 + usage_severity * 2) / 1.8))

    needs_brakes = (rng.random((num_samples, 1)) < brake_probability).astype(float)
    needs_timing_belt = (rng.random((num_samples, 1)) < timing_probability).astype(float)
    needs_battery = (rng.random((num_samples, 1)) < battery_probability).astype(float)

    y = np.hstack((needs_brakes, needs_timing_belt, needs_battery))
    return torch.tensor(X, dtype=torch.float32), torch.tensor(y, dtype=torch.float32)


def train_model(num_samples=20000):
    INPUT_DIM = 3
    HIDDEN_DIM = 64
    OUTPUT_DIM = 3
    EPOCHS = 50
    BATCH_SIZE = 32
    LEARNING_RATE = 0.001
    PATIENCE = 5

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device}")

    torch.manual_seed(42)
    X, y = generate_synthetic_data(num_samples=num_samples)
    dataset = TensorDataset(X, y)
    training_size = int(len(dataset) * 0.8)
    validation_size = len(dataset) - training_size
    training_data, validation_data = torch.utils.data.random_split(
        dataset,
        [training_size, validation_size],
        generator=torch.Generator().manual_seed(42),
    )
    training_loader = DataLoader(training_data, batch_size=BATCH_SIZE, shuffle=True)
    validation_loader = DataLoader(validation_data, batch_size=BATCH_SIZE)

    model = MaintenancePredictor(INPUT_DIM, HIDDEN_DIM, OUTPUT_DIM).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    best_loss = float("inf")
    stale_epochs = 0

    print("Starting training loop...")
    for epoch in range(EPOCHS):
        model.train()
        epoch_loss = 0.0

        for batch_X, batch_y in training_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            optimizer.zero_grad()
            predictions = model(batch_X)
            loss = criterion(predictions, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()

        model.eval()
        validation_loss = 0.0
        with torch.no_grad():
            for batch_X, batch_y in validation_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                validation_loss += criterion(model(batch_X), batch_y).item()

        avg_validation_loss = validation_loss / len(validation_loader)
        if avg_validation_loss < best_loss:
            best_loss = avg_validation_loss
            stale_epochs = 0
            checkpoint_path = MODEL_DIR / "repair_predictor_v2.pth"
            torch.save(model.state_dict(), checkpoint_path)
        else:
            stale_epochs += 1
            if stale_epochs >= PATIENCE:
                print(f"Early stopping triggered at epoch {epoch + 1}")
                break

        if (epoch + 1) % 10 == 0:
            print(
                f"Epoch {epoch + 1}/{EPOCHS} | "
                f"Validation loss: {avg_validation_loss:.4f}"
            )

    print(f"Training complete. Best checkpoint saved with loss {best_loss:.4f}")


if __name__ == "__main__":
    train_model()