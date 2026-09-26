import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
import pickle
import json
import os

def train_model():
    print("Loading dataset...")
    data_path = os.path.join("..", "data", "mesh_telemetry_ml_ready.csv")
    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}")
        return

    df = pd.read_csv(data_path)
    
    # Features for the model
    # We exclude identifiers and target variables
    features = [
        'rssi_dbm', 'pdr_percent', 'latency_ms', 'packet_loss_percent', 
        'battery_level_percent', 'distance_to_gateway', 'hop_count', 
        'neighbor_count', 'frequency_mhz', 'mean_sector_rssi', 
        'max_sector_rssi', 'min_sector_rssi', 'sector_rssi_variance',
        'rssi_delta', 'rssi_rolling_mean_5s', 'rssi_rolling_std_5s',
        'pdr_delta', 'pdr_rolling_mean_5s', 'latency_delta', 
        'latency_rolling_mean_5s', 'battery_delta', 'route_changes_last_30s',
        'disconnects_last_30s', 'distance_delta', 'neighbor_count_delta',
        'time_since_route_change'
    ]
    
    # Target variable
    target = 'actual_link_quality_score'
    
    # Drop rows with NaN in features or target
    df = df.dropna(subset=features + [target])
    
    X = df[features]
    y = df[target]
    
    # Split using the predefined splits if available, otherwise random
    if 'split' in df.columns:
        X_train = df[df['split'] == 'train'][features]
        y_train = df[df['split'] == 'train'][target]
        X_test = df[df['split'] == 'test'][features]
        y_test = df[df['split'] == 'test'][target]
    else:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
    print(f"Training on {len(X_train)} samples, testing on {len(X_test)} samples...")
    
    # Initialize and train XGBoost Regressor
    model = xgb.XGBRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=6,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    predictions = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    mae = mean_absolute_error(y_test, predictions)
    
    print(f"Model Evaluation:")
    print(f"RMSE: {rmse:.4f}")
    print(f"MAE: {mae:.4f}")
    
    # Save model
    model_path = "xgboost_link_quality_model.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    print(f"Model saved to {model_path}")
    
    # Save feature importance
    importance = model.feature_importances_
    feature_importance = {features[i]: float(importance[i]) for i in range(len(features))}
    # Sort by importance
    feature_importance = {k: v for k, v in sorted(feature_importance.items(), key=lambda item: item[1], reverse=True)}
    
    with open("feature_importance.json", "w") as f:
        json.dump(feature_importance, f, indent=4)
    print("Feature importance saved to feature_importance.json")

if __name__ == "__main__":
    train_model()
