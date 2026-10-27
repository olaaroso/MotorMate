import os

import mlflow
import mlflow.pytorch
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

from train import MaintenancePredictor, generate_synthetic_data


def configure_tracking(db_path: str = None):
    """Configure the MLflow sqlite tracking backend and a named experiment."""
    if db_path is None:
        backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        db_path = os.path.join(backend_root, "mlflow.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    mlflow.set_tracking_uri(f"sqlite:///{db_path}")
    mlflow.set_experiment("Vehicle_Maintenance_Prediction")
    return db_path


def train_and_track():
    db_path = configure_tracking()
    params = {
        "input_dim": 3,
        "hidden_dim": 64,
        "output_dim": 3,
        "epochs": 50,
        "training_samples": 20000,
        "batch_size": 32,
        "learning_rate": 0.001,
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    with mlflow.start_run(run_name="MLP_Baseline"):
        mlflow.log_params(params)
        X, y = generate_synthetic_data(num_samples=params["training_samples"])
        dataset = TensorDataset(X, y)
        training_size = int(len(dataset) * 0.8)
        validation_size = len(dataset) - training_size
        training_data, validation_data = torch.utils.data.random_split(
            dataset,
            [training_size, validation_size],
            generator=torch.Generator().manual_seed(42),
        )
        training_loader = DataLoader(
            training_data,
            batch_size=params["batch_size"],
            shuffle=True,
        )
        validation_loader = DataLoader(
            validation_data,
            batch_size=params["batch_size"],
        )

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

            for batch_X, batch_y in training_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                optimizer.zero_grad()
                predictions = model(batch_X)
                loss = criterion(predictions, batch_y)
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()

            avg_loss = epoch_loss / len(training_loader)
            model.eval()
            validation_loss = 0.0
            with torch.no_grad():
                for batch_X, batch_y in validation_loader:
                    batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                    validation_loss += criterion(model(batch_X), batch_y).item()
            avg_validation_loss = validation_loss / len(validation_loader)
            mlflow.log_metric("train_loss", avg_loss, step=epoch)
            mlflow.log_metric("validation_loss", avg_validation_loss, step=epoch)

            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch + 1}/{params['epochs']} | Loss: {avg_loss:.4f}")

        model.eval()
        mlflow.pytorch.log_model(model, "maintenance_model", serialization_format="pickle")
        mlflow.log_param("tracking_db", db_path)
        print("Run complete. Model and metrics successfully logged to MLflow.")


if __name__ == "__main__":
    train_and_track()