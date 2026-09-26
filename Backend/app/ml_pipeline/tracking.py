import os

import mlflow
import mlflow.pytorch
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

from train import MaintenancePredictor, generate_synthetic_data


def configure_tracking(db_path: str = "/workspaces/NextGen-Auto-Care/Backend/mlflow.db"):
    """Configure the MLflow sqlite tracking backend and a named experiment."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    mlflow.set_tracking_uri(f"sqlite:///{db_path}")
    mlflow.set_experiment("Vehicle_Maintenance_Prediction")
    return db_path


def train_and_track():
    db_path = configure_tracking()
    params = {
        "input_dim": 2,
        "hidden_dim": 64,
        "output_dim": 3,
        "epochs": 50,
        "batch_size": 32,
        "learning_rate": 0.001,
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    with mlflow.start_run(run_name="MLP_Baseline"):
        mlflow.log_params(params)
        X, y = generate_synthetic_data()
        dataset = TensorDataset(X, y)
        dataloader = DataLoader(dataset, batch_size=params["batch_size"], shuffle=True)

        model = MaintenancePredictor(
            params["input_dim"],
            params["hidden_dim"],
            params["output_dim"],
        ).to(device)

        criterion = nn.BCEWithLogitsLoss()
        optimizer = optim.Adam(model.parameters(), lr=params["learning_rate"])

        print("Starting MLflow tracking run...")
        for epoch in range(params["epochs"]):
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
            mlflow.log_metric("train_loss", avg_loss, step=epoch)

            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch + 1}/{params['epochs']} | Loss: {avg_loss:.4f}")

        model.eval()
        mlflow.pytorch.log_model(model, "maintenance_model", serialization_format="pickle")
        mlflow.log_param("tracking_db", db_path)
        print("Run complete. Model and metrics successfully logged to MLflow.")


if __name__ == "__main__":
    train_and_track()