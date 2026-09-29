import os

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

os.makedirs("Backend/app/ml_pipeline/models", exist_ok=True)


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


def generate_synthetic_data(num_samples=5000):
    """Generate a basic tabular dataset for model training."""
    print(f"Generating {num_samples} synthetic vehicle records...")

    years = np.random.randint(2005, 2026, size=(num_samples, 1))
    normalized_years = (years - 2000) / 30.0

    mileages = np.random.randint(10000, 200000, size=(num_samples, 1))
    normalized_mileages = mileages / 250000.0

    X = np.hstack((normalized_years, normalized_mileages))

    needs_brakes = ((mileages > 50000) & (np.random.rand(num_samples, 1) > 0.3)).astype(float)
    needs_timing_belt = ((mileages > 100000) & (np.random.rand(num_samples, 1) > 0.2)).astype(float)
    needs_battery = ((years < 2018) & (np.random.rand(num_samples, 1) > 0.4)).astype(float)

    y = np.hstack((needs_brakes, needs_timing_belt, needs_battery))
    return torch.tensor(X, dtype=torch.float32), torch.tensor(y, dtype=torch.float32)


def train_model():
    INPUT_DIM = 2
    HIDDEN_DIM = 64
    OUTPUT_DIM = 3
    EPOCHS = 50
    BATCH_SIZE = 32
    LEARNING_RATE = 0.001
    PATIENCE = 5

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device}")

    X, y = generate_synthetic_data()
    dataset = TensorDataset(X, y)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    model = MaintenancePredictor(INPUT_DIM, HIDDEN_DIM, OUTPUT_DIM).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    best_loss = float("inf")
    stale_epochs = 0

    print("Starting training loop...")
    for epoch in range(EPOCHS):
        model.train()
        epoch_loss = 0.0

        for batch_X, batch_y in dataloader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            optimizer.zero_grad()
            predictions = model(batch_X)
            loss = criterion(predictions, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()

        avg_loss = epoch_loss / len(dataloader)
        if avg_loss < best_loss:
            best_loss = avg_loss
            stale_epochs = 0
            checkpoint_path = "Backend/app/ml_pipeline/models/repair_predictor_v1.pth"
            torch.save(model.state_dict(), checkpoint_path)
        else:
            stale_epochs += 1
            if stale_epochs >= PATIENCE:
                print(f"Early stopping triggered at epoch {epoch + 1}")
                break

        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch + 1}/{EPOCHS} | Loss: {avg_loss:.4f}")

    print(f"Training complete. Best checkpoint saved with loss {best_loss:.4f}")


if __name__ == "__main__":
    train_model()