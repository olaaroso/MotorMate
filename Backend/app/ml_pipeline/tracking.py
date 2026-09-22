import torch
import torch.nn as nn
import torch.optim as optim
import mlflow
import mlflow.pytorch
from torch.utils.data import DataLoader, TensorDataset

# Import the architecture and synthetic data generator from your existing train script
from train import MaintenancePredictor, generate_synthetic_data

def train_and_track():
    # 1. Setup MLflow Tracking
    # Use 4 slashes for an absolute path in SQLite
    mlflow.set_tracking_uri("sqlite:////workspaces/NextGen-Auto-Care/Backend/mlflow.db")
    mlflow.set_experiment("Vehicle_Maintenance_Prediction")
    
    # Group hyperparameters into a dictionary for clean logging
    params = {
        "input_dim": 2,
        "hidden_dim": 64,
        "output_dim": 3,
        "epochs": 50,
        "batch_size": 32,
        "learning_rate": 0.001
    }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # 2. Start the MLflow Run
    with mlflow.start_run(run_name="MLP_Baseline"):
        # Log all hyperparameters instantly
        mlflow.log_params(params)

        X, y = generate_synthetic_data()
        dataset = TensorDataset(X, y)
        dataloader = DataLoader(dataset, batch_size=params["batch_size"], shuffle=True)

        model = MaintenancePredictor(
            params["input_dim"],
            params["hidden_dim"],
            params["output_dim"]
        ).to(device)

        criterion = nn.BCEWithLogitsLoss()
        optimizer = optim.Adam(model.parameters(), lr=params["learning_rate"])

        # 3. Training Loop with Metric Logging
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

            # Log the loss metric for this specific epoch to generate a learning curve
            mlflow.log_metric("train_loss", avg_loss, step=epoch)

            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch+1}/{params['epochs']} | Loss: {avg_loss:.4f}")

        # 4. Log the PyTorch Model Artifact
        # Switch model to evaluation mode (freezes BatchNorm and disables Dropout)
        model.eval()
        
        # Save the model using the standard pickle format to bypass strict pt2 tracing
        mlflow.pytorch.log_model(
            model, 
            "maintenance_model", 
            serialization_format="pickle"
        )
        print("Run complete. Model and metrics successfully logged to MLflow.")

if __name__ == "__main__":
    train_and_track()