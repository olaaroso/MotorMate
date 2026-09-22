import os
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from torch.utils.data import DataLoader, TensorDataset

# Ensure the models directory exists to save the weights
os.makedirs("Backend/app/ml_pipeline/models", exist_ok=True)

# 1. Define the Neural Network Architecture
class MaintenancePredictor(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super(MaintenancePredictor, self).__init__()
        # A standard Feedforward Network for tabular data
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_dim),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, output_dim)
        )

    def forward(self, x):
        # Outputs raw logits. We'll use Sigmoid in the FastAPI service to get probabilities.
        return self.network(x)

# 2. Synthetic Data Generator (Until you get real car data)
def generate_synthetic_data(num_samples=5000):
    """
    Generates dummy vehicle data to train the initial model.
    Features: [Normalized Year, Normalized Mileage]
    Targets (Multi-label): [Needs Brakes, Needs Timing Belt, Needs Battery]
    """
    print(f"Generating {num_samples} synthetic vehicle records...")
    
    # Random years between 2005 and 2026, normalized
    years = np.random.randint(2005, 2026, size=(num_samples, 1))
    normalized_years = (years - 2000) / 30.0 
    
    # Random mileages between 10,000 and 200,000, normalized
    mileages = np.random.randint(10000, 200000, size=(num_samples, 1))
    normalized_mileages = mileages / 250000.0
    
    X = np.hstack((normalized_years, normalized_mileages))
    
    # Generate labels based on simple thresholds with some noise
    # Brakes fail often after 50k miles
    needs_brakes = ((mileages > 50000) & (np.random.rand(num_samples, 1) > 0.3)).astype(float)
    # Timing belts fail often after 100k miles
    needs_timing_belt = ((mileages > 100000) & (np.random.rand(num_samples, 1) > 0.2)).astype(float)
    # Batteries fail on older cars regardless of mileage
    needs_battery = ((years < 2018) & (np.random.rand(num_samples, 1) > 0.4)).astype(float)
    
    y = np.hstack((needs_brakes, needs_timing_belt, needs_battery))
    
    return torch.tensor(X, dtype=torch.float32), torch.tensor(y, dtype=torch.float32)

# 3. Training Loop
def train_model():
    # Hyperparameters
    INPUT_DIM = 2 # Year, Mileage
    HIDDEN_DIM = 64
    OUTPUT_DIM = 3 # Brakes, Timing Belt, Battery
    EPOCHS = 50
    BATCH_SIZE = 32
    LEARNING_RATE = 0.001

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device}")

    # Load data
    X, y = generate_synthetic_data()
    dataset = TensorDataset(X, y)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    # Initialize model, loss function, and optimizer
    model = MaintenancePredictor(INPUT_DIM, HIDDEN_DIM, OUTPUT_DIM).to(device)
    
    # BCEWithLogitsLoss is perfect for multi-label classification 
    # (a car might need brakes AND a battery at the same time)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

    print("Starting training loop...")
    for epoch in range(EPOCHS):
        model.train()
        epoch_loss = 0.0
        
        for batch_X, batch_y in dataloader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            
            # Forward pass
            predictions = model(batch_X)
            loss = criterion(predictions, batch_y)
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}/{EPOCHS} | Loss: {epoch_loss/len(dataloader):.4f}")

    # 4. Save the trained weights
    save_path = "Backend/app/ml_pipeline/models/repair_predictor_v1.pth"
    torch.save(model.state_dict(), save_path)
    print(f"Training complete. Model weights saved to {save_path}")

if __name__ == "__main__":
    train_model()