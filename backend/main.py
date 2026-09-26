from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import random
import time
import os
import pandas as pd
from typing import List, Dict, Any
import math

app = FastAPI(title="NSG Tactical Mesh Network API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load synthetic data summary
summary_path = os.path.join("..", "data", "synthetic_data_summary.json")
try:
    with open(summary_path, "r") as f:
        synthetic_summary = json.load(f)
except:
    synthetic_summary = {"error": "Summary not found"}

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error sending message to client: {e}")

manager = ConnectionManager()

simulation_state = {
    "is_running": False,
    "mission_id": None,
    "time": 0,
    "settings": {
        "frequency": 865,
        "environment": "OUTDOOR",
        "speed": 1
    }
}

@app.get("/")
def read_root():
    return {"status": "ONLINE", "service": "NSG Mesh Simulation Backend"}

@app.get("/api/status")
def get_status():
    return {
        "gateway": "ONLINE",
        "simulation_engine": "ONLINE" if simulation_state["is_running"] else "IDLE",
        "ai_model": "ONLINE",
        "database": "ONLINE",
        "websocket": "ONLINE",
        "mesh_routing": "ONLINE"
    }

@app.get("/api/data/summary")
def get_data_summary():
    return synthetic_summary

@app.post("/api/simulation/start")
def start_simulation():
    simulation_state["is_running"] = True
    simulation_state["mission_id"] = f"SIM-2026-{random.randint(100, 999)}"
    return {"status": "started", "mission_id": simulation_state["mission_id"]}

FEATURES = [
    "rssi_dbm", "pdr_percent", "latency_ms", "packet_loss_percent",
    "battery_level_percent", "distance_to_gateway", "hop_count",
    "neighbor_count", "frequency_mhz", "mean_sector_rssi",
    "max_sector_rssi", "min_sector_rssi", "sector_rssi_variance",
    "rssi_delta", "rssi_rolling_mean_5s", "rssi_rolling_std_5s",
    "pdr_delta", "pdr_rolling_mean_5s", "latency_delta",
    "latency_rolling_mean_5s", "battery_delta", "route_changes_last_30s",
    "disconnects_last_30s", "distance_delta", "neighbor_count_delta",
    "time_since_route_change",
]
CLASSES = ["EXCELLENT", "GOOD", "DEGRADED", "CRITICAL", "FAILED"]

def score_to_class(score: float) -> str:
    if score >= 90: return "EXCELLENT"
    if score >= 75: return "GOOD"
    if score >= 50: return "DEGRADED"
    if score >= 25: return "CRITICAL"
    return "FAILED"

def load_model():
    import pickle
    path = os.path.join("..", "ml", "xgboost_link_quality_model.pkl")
    with open(path, "rb") as f:
        return pickle.load(f)

@app.post("/api/analyze")
def analyze_mission(payload: Dict[str, Any]):
    links = pd.DataFrame(payload.get("links") or [])
    nodes = pd.DataFrame(payload.get("nodes") or [])
    if links.empty:
        return {"error": "No link samples in this mission."}
    links = links.sort_values(["source", "target", "timestamp"]).copy()
    grouped = links.groupby(["source", "target"], sort=False)
    links["distance_to_gateway"] = links["distance"]
    links["rssi_delta"] = grouped["rssi_dbm"].diff().fillna(0)
    links["pdr_delta"] = grouped["pdr_percent"].diff().fillna(0)
    links["latency_delta"] = grouped["latency_ms"].diff().fillna(0)
    links["battery_delta"] = grouped["battery_level_percent"].diff().fillna(0)
    links["distance_delta"] = grouped["distance"].diff().fillna(0)
    links["neighbor_count_delta"] = grouped["neighbor_count"].diff().fillna(0)
    links["rssi_rolling_mean_5s"] = grouped["rssi_dbm"].transform(lambda s: s.rolling(5, min_periods=1).mean())
    links["rssi_rolling_std_5s"] = grouped["rssi_dbm"].transform(lambda s: s.rolling(5, min_periods=1).std()).fillna(0)
    links["pdr_rolling_mean_5s"] = grouped["pdr_percent"].transform(lambda s: s.rolling(5, min_periods=1).mean())
    links["latency_rolling_mean_5s"] = grouped["latency_ms"].transform(lambda s: s.rolling(5, min_periods=1).mean())
    links["route_changes_last_30s"] = 0
    links["disconnects_last_30s"] = grouped["is_neighbour"].transform(lambda s: (1 - s).rolling(30, min_periods=1).sum())
    links["time_since_route_change"] = grouped.cumcount()
    model = load_model()
    X = links[FEATURES].astype(float)
    pred = model.predict(X)
    links["predicted_link_quality_score"] = pred
    links["predicted_link_quality_class"] = [score_to_class(float(v)) for v in pred]
    actual = links["actual_link_quality_class"].tolist()
    predicted = links["predicted_link_quality_class"].tolist()
    from sklearn.metrics import (
        accuracy_score, precision_recall_fscore_support, confusion_matrix,
        mean_absolute_error, mean_squared_error, r2_score,
    )
    import numpy as np
    labels = CLASSES
    cm = confusion_matrix(actual, predicted, labels=labels).tolist()
    precision, recall, f1, support = precision_recall_fscore_support(actual, predicted, labels=labels, zero_division=0)
    y = links["actual_link_quality_score"].astype(float)
    mae = float(mean_absolute_error(y, pred))
    rmse = float(np.sqrt(mean_squared_error(y, pred)))
    r2 = float(r2_score(y, pred)) if len(y) > 1 else 0.0
    per_class = []
    for i, name in enumerate(labels):
        per_class.append({
            "class": name,
            "precision": float(precision[i]),
            "recall": float(recall[i]),
            "f1": float(f1[i]),
            "support": int(support[i]),
        })
    def avg(frame, col):
        return float(frame[col].mean()) if len(frame) else 0.0
    neighbours = links[links["is_neighbour"] == 1]
    wall_bins = []
    for label, mask in [
        ("0", links["walls_crossed"] == 0),
        ("1", links["walls_crossed"] == 1),
        ("2", links["walls_crossed"] == 2),
        ("3", links["walls_crossed"] == 3),
        ("4+", links["walls_crossed"] >= 4),
    ]:
        part = links[mask]
        wall_bins.append({"walls": label, "count": int(len(part)), "rssi": avg(part, "rssi_dbm"), "pdr": avg(part, "pdr_percent"), "latency": avg(part, "latency_ms"), "quality": avg(part, "actual_link_quality_score")})
    buckets = [(0, 25), (25, 50), (50, 100), (100, 150), (150, 200), (200, 300), (300, 10000)]
    distance_bins = []
    for a, b in buckets:
        part = links[(links["distance"] >= a) & (links["distance"] < b)]
        connected = part[part["is_neighbour"] == 1]
        distance_bins.append({
            "bucket": f"{a}-{b if b < 10000 else '+'} m" if b < 10000 else "300+ m",
            "count": int(len(part)),
            "rssi": avg(connected, "rssi_dbm"),
            "pdr": avg(connected, "pdr_percent"),
            "latency": avg(connected, "latency_ms"),
            "quality": avg(connected, "actual_link_quality_score"),
            "success": float(len(connected) / len(part)) if len(part) else 0,
        })
    node_reports = []
    if not nodes.empty:
        for node_id, part in nodes.groupby("node_id"):
            related = links[(links["source"] == node_id) | (links["target"] == node_id)]
            route_changes = int((part["selected_route"] != part["selected_route"].shift()).sum() - 1) if len(part) else 0
            node_reports.append({
                "node_id": node_id,
                "avg_battery": avg(part, "battery"),
                "avg_hop": avg(part, "hop_count"),
                "avg_neighbors": avg(part, "neighbor_count"),
                "route_changes": max(0, route_changes),
                "disconnect_rows": int((part["node_status"] == "DISCONNECTED").sum()),
                "distance_span": float((part["x"].max() - part["x"].min()) + (part["y"].max() - part["y"].min())) if len(part) else 0,
                "prediction_mae": float(np.mean(np.abs(related["actual_link_quality_score"] - related["predicted_link_quality_score"]))) if len(related) else 0,
            })
    timeline = []
    if not nodes.empty:
        for ts, part in nodes.groupby("timestamp"):
            hop = part["hop_count"].replace(-1, np.nan).mean()
            timeline.append({"t": int(ts), "hop": float(0 if pd.isna(hop) else hop), "battery": avg(part, "battery")})
    active = links[links["is_active_route"] == 1]
    scatter = links.sample(n=min(400, len(links)), random_state=1)[["actual_link_quality_score", "predicted_link_quality_score"]].to_dict(orient="records")
    return {
        "label": "SIMULATION MODEL PERFORMANCE",
        "note": "Predictions use the saved XGBoost model trained on the historical synthetic dataset. This mission was not used for training. actual_link_quality_score was not an input feature.",
        "mission_id": payload.get("mission_id"),
        "duration_s": payload.get("duration_s"),
        "frequency_mhz": payload.get("frequency_mhz"),
        "environment": payload.get("environment"),
        "samples": int(len(links)),
        "node_rows": int(len(nodes)),
        "pairwise_observations": int(len(links)),
        "confusion_matrix": cm,
        "classes": labels,
        "accuracy": float(accuracy_score(actual, predicted)),
        "macro_f1": float(np.mean(f1)),
        "weighted_f1": float(np.average(f1, weights=np.maximum(support, 1))),
        "per_class": per_class,
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "network": {
            "average_rssi": avg(neighbours if len(neighbours) else links, "rssi_dbm"),
            "average_pdr": avg(neighbours if len(neighbours) else links, "pdr_percent"),
            "average_latency": avg(active if len(active) else links, "latency_ms"),
            "packet_loss": avg(neighbours if len(neighbours) else links, "packet_loss_percent"),
            "average_hop_count": avg(nodes, "hop_count") if not nodes.empty else 0,
            "average_neighbours": avg(nodes, "neighbor_count") if not nodes.empty else 0,
            "connected_rows": int((nodes["node_status"] != "DISCONNECTED").sum()) if not nodes.empty else 0,
            "disconnected_rows": int((nodes["node_status"] == "DISCONNECTED").sum()) if not nodes.empty else 0,
            "active_route_observations": int(len(active)),
        },
        "wall_bins": wall_bins,
        "distance_bins": distance_bins,
        "nodes": node_reports,
        "timeline": timeline,
        "scatter": scatter,
        "flow_counts": {
            "captured": int(len(links)),
        },
    }

@app.post("/api/simulation/stop")
def stop_simulation():
    simulation_state["is_running"] = False
    return {"status": "stopped"}

@app.websocket("/ws/simulation")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            # Handle incoming messages from frontend
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def simulation_loop():
    while True:
        if simulation_state["is_running"]:
            simulation_state["time"] += 1
            await manager.broadcast(json.dumps({
                "type": "SIMULATION_TICK",
                "time": simulation_state["time"]
            }))
        await asyncio.sleep(1.0 / simulation_state["settings"]["speed"])

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
