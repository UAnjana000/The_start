# %% [markdown]
# # Tactical wireless mesh simulation
#
# This notebook builds a **synthetic** time-series dataset for a helmet-mounted
# mesh prototype. It is a simulation, not a recording of an operational network.
#
# - `65 MHz` and `1200 MHz` are **prototype simulation configurations**. They are
#   not claimed to be NSG operating frequencies.
# - Latitude and longitude are **fictional visualization coordinates** around
#   12.9716, 77.5946. They are not deployment locations.
#
# Columns are not sampled independently. Each second updates positions, applies
# a path-loss model, discovers neighbours, routes to the gateway, then derives
# PDR, packet loss, latency, battery drain, and link quality from that state.

# %%
import argparse
import json
import math
from pathlib import Path

import matplotlib

try:
    get_ipython()  # noqa: F821
except NameError:
    matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    def tqdm(iterable, **kwargs):
        return iterable

# Reproducibility
SEED = 42

# Network
NUM_MISSIONS = 100
NODE_NAMES = ["Node_A", "Node_B", "Node_C", "Node_D", "Node_E", "Node_F"]
GATEWAY_NAME = "Gateway"
ALL_NAMES = [GATEWAY_NAME] + NODE_NAMES
N_NODES = len(ALL_NAMES)  # index 0 is the gateway
COMMANDO_INDEX = np.arange(1, N_NODES)

# Prototype RF configurations (not operational frequencies)
FREQUENCIES_MHZ = np.array([65, 1200], dtype=int)
ENVIRONMENTS = np.array(["OUTDOOR", "INDOOR", "MIXED"])
ENV_PROBS = np.array([0.35, 0.35, 0.30])

# Fictional map centre for visualization only
BASE_LAT = 12.9716
BASE_LON = 77.5946
METERS_PER_DEGREE = 111_320.0

# Operating area, metres
AREA_M = 500.0
GATEWAY_XY = np.array([250.0, 250.0])

# Configurable radio constants
TX_POWER_DBM = 26.0
TX_GAIN_DBI = 2.0
RX_GAIN_DBI = 2.0
RX_SENSITIVITY_DBM = -110.0
BODY_LOSS_DB = 1.5
# Helmet directivity is in the sector pattern. 1200 MHz also picks up extra
# clutter because shorter wavelengths interact more with gear and small obstacles.
ANTENNA_INEFFICIENCY_DB = {65: 0.0, 1200: 2.0}
FREQUENCY_CLUTTER_DB = {65: 0.0, 1200: 11.0}
RSSI_CEILING_DBM = -35.0
RSSI_FLOOR_DBM = -125.0

# Environment propagation. n is the distance exponent; free space is n = 2.
# Values above 2 are excess loss over FSPL (ground, clutter, indoor multipath).
ENV_PARAMS = {
    "OUTDOOR": {"n": 2.48, "clutter_db": 4.0, "wall_spacing_m": None},
    "MIXED": {"n": 2.72, "clutter_db": 6.0, "wall_spacing_m": 210.0},
    "INDOOR": {"n": 3.15, "clutter_db": 10.0, "wall_spacing_m": 100.0},
}

# Per-wall attenuation. Concrete is higher than glass. Drawn once per link.
WALL_MATERIALS = {
    "GLASS": (3.0, 4.2),
    "WOOD": (4.0, 6.0),
    "BRICK": (6.0, 8.2),
    "CONCRETE": (8.0, 10.0),
}

SECTOR_BORESIGHTS_DEG = np.array([0.0, 90.0, 180.0, 270.0])
MOVEMENT_MODES = np.array(["STATIC", "WALKING", "PATROL", "RANDOM_WALK"])

# At least 15% of missions carry a scenario event. 30% keeps transitions common.
EVENT_MISSION_FRACTION = 0.30
EVENT_TYPES = [
    "NODE MOVES BEHIND WALL",
    "NODE ENTERS BUILDING",
    "NODE EXITS BUILDING",
    "RELAY NODE FAILURE",
    "LOW BATTERY RELAY",
    "NODE TEMPORARILY DISCONNECTED",
    "SIGNAL RECOVERY",
    "SUDDEN INTERFERENCE",
    "ROUTE HANDOVER",
]

RAW_COLUMNS = [
    "mission_id",
    "timestamp",
    "node_id",
    "latitude",
    "longitude",
    "simulation_x",
    "simulation_y",
    "frequency_mhz",
    "environment",
    "movement_state",
    "distance_to_gateway",
    "rssi_dbm",
    "pdr_percent",
    "latency_ms",
    "packet_loss_percent",
    "battery_level_percent",
    "active_antenna_sector",
    "sector_1_rssi",
    "sector_2_rssi",
    "sector_3_rssi",
    "sector_4_rssi",
    "connected_neighbors",
    "neighbor_count",
    "next_hop",
    "selected_route",
    "hop_count",
    "mesh_topology_snapshot",
    "node_status",
    "last_seen_seconds",
    "route_change",
    "route_change_reason",
    "predicted_link_quality",
    "actual_link_quality_score",
    "link_quality_class",
]


# %% [markdown]
# ## Propagation, PDR, latency, and link quality
#
# Free-space path loss is the baseline. Environment loss, walls, shadowing,
# small-scale fading, and antenna-sector orientation are added on top.
# PDR, packet loss, and latency are then computed from that radio state and
# from the route, so they move together instead of being drawn separately.

# %%
def fspl_db(distance_m, frequency_mhz):
    """Free-space path loss in dB. Distance is clamped to 1 m."""
    distance_km = np.maximum(distance_m, 1.0) / 1000.0
    return 32.44 + 20.0 * np.log10(distance_km) + 20.0 * np.log10(frequency_mhz)


def sector_deltas_db(bearing_deg):
    """Directional gain relative to boresight, shape (..., 4).

    0 dB on boresight, increasingly negative toward the backlobe.
    Boresights are 0, 90, 180, and 270 degrees (0 degrees is +x).
    """
    err = np.abs((bearing_deg[..., None] - SECTOR_BORESIGHTS_DEG + 180.0) % 360.0 - 180.0)
    delta = np.empty(err.shape, dtype=float)
    near = err <= 45.0
    side = (err > 45.0) & (err <= 90.0)
    back = err > 90.0
    delta[near] = -2.0 * (err[near] / 45.0)
    delta[side] = -2.0 - 6.0 * ((err[side] - 45.0) / 45.0)
    delta[back] = -8.0 - 6.0 * ((err[back] - 90.0) / 90.0)
    return delta


def pdr_from_rssi(rssi, rng):
    """Map RSSI to packet delivery ratio with a small amount of noise."""
    rssi = np.asarray(rssi, dtype=float)
    base = np.empty(rssi.shape, dtype=float)
    strong = rssi >= -65.0
    medium = (rssi < -65.0) & (rssi >= -85.0)
    weak = (rssi < -85.0) & (rssi >= -100.0)
    edge = (rssi < -100.0) & (rssi >= RX_SENSITIVITY_DBM)
    dead = rssi < RX_SENSITIVITY_DBM
    # -35 -> about 100, -65 -> 97
    base[strong] = 97.0 + (np.minimum(rssi[strong], -35.0) + 65.0) * (3.0 / 30.0)
    # -65 -> 97, -85 -> 85
    base[medium] = 85.0 + (rssi[medium] + 85.0) * (12.0 / 20.0)
    # -85 -> 85, -100 -> 50
    base[weak] = 50.0 + (rssi[weak] + 100.0) * (35.0 / 15.0)
    # Rapid drop near the receiver sensitivity threshold.
    base[edge] = (rssi[edge] - RX_SENSITIVITY_DBM) * (50.0 / 10.0)
    base[dead] = 0.0
    noise = rng.normal(0.0, 1.15, size=rssi.shape)
    return np.clip(base + noise, 0.0, 100.0)


def packet_loss_from_pdr(pdr, rng):
    """Packet loss tracks 100 - PDR, with a small stochastic gap."""
    noise = rng.normal(0.0, 0.7, size=np.shape(pdr))
    return np.clip(100.0 - pdr + noise, 0.0, 100.0)


def hop_latency_ms(rssi, packet_loss, rng):
    """One-hop latency. Retransmission delay grows faster than linear in loss."""
    base = rng.uniform(15.0, 28.0, size=np.shape(rssi))
    loss_frac = np.clip(packet_loss, 0.0, 100.0) / 100.0
    retransmission = (loss_frac ** 0.85) * (28.0 + packet_loss * 0.9)
    weak_signal = np.maximum(0.0, -82.0 - rssi) * 1.15
    jitter = np.abs(rng.normal(0.0, 2.2, size=np.shape(rssi)))
    return base + retransmission + weak_signal + jitter


def quality_class(score):
    """Map a 0..100 score to the five link-quality classes."""
    if score >= 90.0:
        return "EXCELLENT"
    if score >= 75.0:
        return "GOOD"
    if score >= 50.0:
        return "DEGRADED"
    if score >= 25.0:
        return "CRITICAL"
    return "FAILED"


def link_quality_score(rssi, pdr, latency_ms, packet_loss, hop_count, route_changes_30s, rng):
    """Weighted link quality in 0..100, with a small noise term.

    Hop count enters through route stability and through latency, which already
    includes a nonlinear per-hop cost.
    """
    norm_rssi = np.clip((rssi - RX_SENSITIVITY_DBM) / (RSSI_CEILING_DBM - RX_SENSITIVITY_DBM), 0.0, 1.0) * 100.0
    inv_latency = 100.0 * np.exp(-np.maximum(latency_ms, 0.0) / 155.0)
    inv_loss = np.clip(100.0 - packet_loss, 0.0, 100.0)
    change_score = np.clip(100.0 - route_changes_30s * 14.0, 0.0, 100.0)
    hop = np.asarray(hop_count, dtype=float)
    hop_score = np.where(
        hop < 0,
        0.0,
        np.clip(100.0 - np.maximum(hop - 1.0, 0.0) * 24.0, 0.0, 100.0),
    )
    route_stability = 0.60 * change_score + 0.40 * hop_score
    quality = (
        0.35 * norm_rssi
        + 0.30 * pdr
        + 0.15 * inv_latency
        + 0.10 * inv_loss
        + 0.10 * route_stability
    )
    # Near the sensitivity floor the score falls faster than the linear RSSI term.
    quality = quality - np.maximum(0.0, -88.0 - np.asarray(rssi, dtype=float)) * 0.55 + 2.0
    quality = quality + rng.normal(0.0, 1.25, size=np.shape(quality))
    quality = calibrate_quality(quality)
    return np.clip(quality, 0.0, 100.0)


def calibrate_quality(score):
    """Nonlinear map so strong and failed links are not piled against the cuts.

    Poor scores are lifted only part of the way, so true outages stay FAILED.
    High scores are compressed slightly so not every strong 65 MHz link is EXCELLENT.
    """
    score = np.asarray(score, dtype=float)
    adjusted = np.where(score < 40.0, 0.35 * score + 22.0, 0.815 * score + 15.0)
    return np.clip(adjusted, 0.0, 100.0)


def naive_predicted_quality(rssi, pdr, rng):
    """A simple RSSI/PDR estimate. It is not the training label."""
    norm_rssi = np.clip((rssi - RX_SENSITIVITY_DBM) / (RSSI_CEILING_DBM - RX_SENSITIVITY_DBM), 0.0, 1.0) * 100.0
    pred = 0.55 * norm_rssi + 0.45 * pdr + rng.normal(0.0, 3.0, size=np.shape(rssi))
    return np.clip(pred, 0.0, 100.0)


# %% [markdown]
# ## Mobility, walls, and routing
#
# Nodes walk continuously inside the 500 m square. The gateway stays put.
# Each second the simulator rebuilds the mesh graph and runs Dijkstra with a
# cost on RSSI, loss, latency, battery, and distance. The previous route is
# kept unless the new one is clearly better or the old one breaks, so routes
# do not flap on every fade sample.

# %%
def _reflect_bounds(pos, vel):
    """Keep positions inside the square by reflecting velocity."""
    for axis in (0, 1):
        low = pos[:, axis] < 0.0
        high = pos[:, axis] > AREA_M
        pos[low, axis] = -pos[low, axis]
        vel[low, axis] = -vel[low, axis]
        pos[high, axis] = 2.0 * AREA_M - pos[high, axis]
        vel[high, axis] = -vel[high, axis]
    np.clip(pos, 0.0, AREA_M, out=pos)


PROFILE_RADII = {
    "COMPACT": np.array([12.0, 22.0, 38.0, 58.0, 82.0, 110.0]),
    "STANDARD": np.array([30.0, 75.0, 120.0, 170.0, 225.0, 285.0]),
    "EXTENDED": np.array([60.0, 130.0, 200.0, 270.0, 340.0, 420.0]),
}


def _initial_positions(rng, profile):
    """Spread commandos from near the gateway out toward the edge."""
    order = rng.permutation(6)
    radii = PROFILE_RADII[profile][order]
    radii = radii * rng.uniform(0.90, 1.10, size=6)
    angles = rng.uniform(0.0, 2.0 * math.pi, size=6)
    pos = np.zeros((N_NODES, 2), dtype=float)
    pos[0] = GATEWAY_XY
    pos[1:, 0] = GATEWAY_XY[0] + radii * np.cos(angles)
    pos[1:, 1] = GATEWAY_XY[1] + radii * np.sin(angles)
    np.clip(pos, 8.0, AREA_M - 8.0, out=pos)
    pos[0] = GATEWAY_XY.copy()
    return pos


def _assign_movement(rng):
    """Gateway is static. Commandos get a mode and a speed in 0..2 m/s."""
    mode = np.empty(N_NODES, dtype=object)
    mode[0] = "STATIC"
    mode[1:] = rng.choice(MOVEMENT_MODES, size=6, p=[0.12, 0.38, 0.28, 0.22])
    speed = np.zeros(N_NODES, dtype=float)
    for i in range(1, N_NODES):
        if mode[i] == "STATIC":
            speed[i] = 0.0
        elif mode[i] == "WALKING":
            speed[i] = rng.uniform(0.9, 1.7)
        elif mode[i] == "PATROL":
            speed[i] = rng.uniform(0.7, 1.5)
        else:
            speed[i] = rng.uniform(0.3, 1.3)
    speed = np.clip(speed, 0.0, 2.0)
    heading = rng.uniform(0.0, 2.0 * math.pi, size=N_NODES)
    waypoints = np.zeros((N_NODES, 3, 2), dtype=float)
    for i in range(1, N_NODES):
        waypoints[i] = rng.uniform(20.0, AREA_M - 20.0, size=(3, 2))
    wp_index = np.zeros(N_NODES, dtype=int)
    return mode, speed, heading, waypoints, wp_index


def _step_motion(pos, vel, mode, speed, heading, waypoints, wp_index, rng):
    """Advance one second. Velocity changes are incremental."""
    pos[0] = GATEWAY_XY
    vel[0] = 0.0
    for i in range(1, N_NODES):
        if mode[i] == "STATIC":
            vel[i] = 0.0
            continue
        if mode[i] == "RANDOM_WALK":
            heading[i] = heading[i] + rng.normal(0.0, 0.35)
            vel[i, 0] = speed[i] * math.cos(heading[i])
            vel[i, 1] = speed[i] * math.sin(heading[i])
        else:
            w = int(wp_index[i] if mode[i] == "PATROL" else 0)
            target = waypoints[i, w]
            delta = target - pos[i]
            dist = float(np.hypot(delta[0], delta[1]))
            if dist < 2.0:
                if mode[i] == "PATROL":
                    wp_index[i] = (w + 1) % 3
                else:
                    waypoints[i, 0] = rng.uniform(15.0, AREA_M - 15.0, size=2)
                delta = waypoints[i, int(wp_index[i] if mode[i] == "PATROL" else 0)] - pos[i]
                dist = float(np.hypot(delta[0], delta[1]))
            if dist < 1e-6:
                vel[i] = 0.0
            else:
                vel[i] = (delta / dist) * speed[i]
        pos[i] = pos[i] + vel[i]
    _reflect_bounds(pos, vel)
    pos[0] = GATEWAY_XY.copy()
    vel[0] = 0.0


def _symmetric_normal(rng, scale, size):
    raw = rng.normal(0.0, scale, size=size)
    return (raw + raw.T) / 2.0


def _pair_constants(rng, environment):
    """Stable per-link wall material and a small spatial bias."""
    bias = _symmetric_normal(rng, 0.35, (N_NODES, N_NODES))
    np.fill_diagonal(bias, 0.0)
    materials = list(WALL_MATERIALS)
    wall_db = np.zeros((N_NODES, N_NODES), dtype=float)
    wall_name = np.empty((N_NODES, N_NODES), dtype=object)
    for i in range(N_NODES):
        for j in range(i + 1, N_NODES):
            # Concrete is less common than lighter partitions, but heavier.
            name = rng.choice(materials, p=[0.22, 0.28, 0.30, 0.20])
            low, high = WALL_MATERIALS[name]
            loss = float(rng.uniform(low, high))
            wall_db[i, j] = wall_db[j, i] = loss
            wall_name[i, j] = wall_name[j, i] = name
    indoor = np.zeros(N_NODES, dtype=bool)
    if environment == "INDOOR":
        indoor[:] = True
    elif environment == "MIXED":
        indoor[1:] = rng.random(6) < 0.40
        indoor[0] = False
    return bias, wall_db, wall_name, indoor


def _wall_count(distance_m, environment, indoor, pair_bias, extra_walls):
    spacing = ENV_PARAMS[environment]["wall_spacing_m"]
    if environment == "OUTDOOR" or spacing is None:
        walls = np.zeros_like(distance_m)
    else:
        raw = np.rint(distance_m / spacing + pair_bias)
        if environment == "MIXED":
            involved = indoor[:, None] | indoor[None, :]
            walls = np.where(involved, raw, 0.0)
        else:
            walls = raw
    walls = walls + extra_walls[:, None] + extra_walls[None, :]
    np.fill_diagonal(walls, 0.0)
    return np.clip(walls, 0.0, 5.0)


def _path_loss_matrix(distance_m, frequency_mhz, environment, walls, wall_db, shadow, small_fade, indoor, extra_loss):
    """Total path loss. Components add; they are not independent random columns."""
    params = ENV_PARAMS[environment]
    fspl = fspl_db(distance_m, frequency_mhz)
    excess = 10.0 * (params["n"] - 2.0) * np.log10(np.maximum(distance_m, 1.0))
    clutter = params["clutter_db"] + 1.6 * np.log10(np.maximum(distance_m, 10.0) / 10.0)
    wall_loss = walls * wall_db
    one_side_indoor = np.logical_xor(indoor[:, None], indoor[None, :])
    penetration = np.where(one_side_indoor, 8.0, 0.0)
    inefficiency = ANTENNA_INEFFICIENCY_DB[int(frequency_mhz)] + FREQUENCY_CLUTTER_DB[int(frequency_mhz)]
    total = fspl + excess + clutter + wall_loss + shadow + small_fade + BODY_LOSS_DB + inefficiency + penetration + extra_loss
    np.fill_diagonal(total, 0.0)
    return total


def _receive_rssi(path_loss, sector_delta):
    """RSSI at each receiver sector.

    sector_delta[i, j, k] is node i's sector k while looking at node j.
    The transmitter uses its best sector toward the receiver.
    """
    tx_best = sector_delta.max(axis=-1)  # [tx, rx]
    # Signal at receiver i from transmitter j, on receiver sector k.
    # sector_delta[j, i] is the transmitter's pattern toward the receiver.
    rssi = (
        TX_POWER_DBM
        + TX_GAIN_DBI
        + RX_GAIN_DBI
        + tx_best.T[..., None]
        + sector_delta
        - path_loss[..., None]
    )
    return np.clip(rssi, RSSI_FLOOR_DBM, RSSI_CEILING_DBM)


def _edge_cost(rssi, packet_loss, latency_ms, battery, distance_m):
    rssi_penalty = np.clip((-rssi - 48.0) / 62.0, 0.0, 1.0) * 100.0
    latency_penalty = np.clip(latency_ms / 160.0, 0.0, 1.0) * 100.0
    battery_penalty = np.clip((35.0 - battery) / 35.0, 0.0, 1.0) * 100.0
    # A link is only as healthy as the weaker battery at its ends.
    bat = battery_penalty[:, None] + battery_penalty[None, :]
    bat = np.clip(bat, 0.0, 100.0)
    distance_penalty = np.clip(distance_m / AREA_M, 0.0, 1.0) * 100.0
    cost = (
        0.30 * rssi_penalty
        + 0.30 * packet_loss
        + 0.20 * latency_penalty
        + 0.10 * bat
        + 0.10 * distance_penalty
    )
    return np.maximum(cost, 0.05)


def _dijkstra(cost, source, target):
    """Shortest path on a 7-node dense graph. Returns (path, total_cost) or (None, inf)."""
    dist = np.full(N_NODES, np.inf)
    prev = np.full(N_NODES, -1, dtype=int)
    dist[source] = 0.0
    used = np.zeros(N_NODES, dtype=bool)
    for _ in range(N_NODES):
        masked = np.where(used, np.inf, dist)
        u = int(np.argmin(masked))
        if not np.isfinite(masked[u]):
            break
        if u == target:
            break
        used[u] = True
        for v in range(N_NODES):
            w = cost[u, v]
            if w < np.inf and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
    if not np.isfinite(dist[target]):
        return None, np.inf
    path = []
    cur = target
    seen = set()
    while cur != -1 and cur not in seen:
        seen.add(cur)
        path.append(cur)
        if cur == source:
            break
        cur = int(prev[cur])
    path.reverse()
    if not path or path[0] != source or path[-1] != target:
        return None, np.inf
    return path, float(dist[target])


def _path_cost(cost, path):
    total = 0.0
    for a, b in zip(path[:-1], path[1:]):
        w = cost[a, b]
        if not np.isfinite(w):
            return np.inf
        total += w
    return total


def _format_route(path):
    if not path:
        return "DISCONNECTED", "NONE", -1
    names = [ALL_NAMES[i] for i in path]
    return ">".join(names), names[1], len(path) - 1


def _reason_for_change(prev_path, new_path, node, pos, pos_at_route, battery, offline, obstacle, direct_drop):
    if prev_path == new_path:
        return 0, "NO_CHANGE"
    prev_disc = prev_path is None
    new_disc = new_path is None
    if prev_disc and not new_disc:
        return 1, "RECONNECTED"
    old_nodes = [] if prev_path is None else prev_path
    failed_relay = bool(offline[node]) or any(bool(offline[i]) for i in old_nodes if i != node)
    if new_disc:
        if failed_relay:
            return 1, "NODE_FAILURE"
        if obstacle:
            return 1, "OBSTACLE_LOSS"
        return 1, "DIRECT_LINK_WEAK"
    if failed_relay:
        return 1, "NODE_FAILURE"
    if any(battery[i] < 20.0 for i in old_nodes):
        return 1, "LOW_BATTERY"
    if obstacle:
        return 1, "OBSTACLE_LOSS"
    if direct_drop:
        return 1, "DIRECT_LINK_WEAK"
    if pos_at_route is not None and float(np.hypot(*(pos[node] - pos_at_route[node]))) > 12.0:
        return 1, "NODE_MOVED"
    return 1, "BETTER_NEIGHBOR_AVAILABLE"


def _schedule_events(rng, mission_id, duration, modes):
    """Scenario events for a subset of missions. Returns a list of event dicts."""
    events = []
    n_events = int(rng.choice([1, 2], p=[0.75, 0.25]))
    used_nodes = set()
    for _ in range(n_events):
        choices = [i for i in range(1, N_NODES) if i not in used_nodes]
        node = int(rng.choice(choices if choices else np.arange(1, N_NODES)))
        used_nodes.add(node)
        kind = str(rng.choice(
            EVENT_TYPES,
            p=[0.11, 0.10, 0.10, 0.13, 0.10, 0.14, 0.10, 0.12, 0.10],
        ))
        start = int(rng.integers(int(duration * 0.18), max(int(duration * 0.62), int(duration * 0.18) + 1)))
        span = int(rng.integers(35, 110))
        end = min(duration - 1, start + span)
        # Recovery is meaningful only after a fade window.
        if kind == "SIGNAL RECOVERY":
            fade_start = max(5, start - int(rng.integers(25, 45)))
            events.append({
                "mission_id": mission_id,
                "node_index": node,
                "node_id": NODE_NAMES[node - 1],
                "event_type": "NODE TEMPORARILY DISCONNECTED",
                "start_second": fade_start,
                "end_second": start,
                "notes": "Fade window that precedes signal recovery",
            })
        events.append({
            "mission_id": mission_id,
            "node_index": node,
            "node_id": NODE_NAMES[node - 1],
            "event_type": kind,
            "start_second": start,
            "end_second": duration - 1 if kind == "RELAY NODE FAILURE" else end,
            "notes": f"movement={modes[node]}",
        })
    return events


def _plan_missions(rng, num_missions):
    plans = []
    event_slots = set(int(i) for i in rng.choice(np.arange(num_missions), size=max(1, int(round(num_missions * EVENT_MISSION_FRACTION))), replace=False))
    low_batt_slots = set(int(i) for i in rng.choice(np.arange(num_missions), size=max(1, int(round(num_missions * 0.12))), replace=False))
    # Balanced random assignment so a 100-mission run lands near the requested mix.
    freq_plan = np.array([65] * (num_missions // 2) + [1200] * (num_missions - num_missions // 2))
    rng.shuffle(freq_plan)
    n_out = int(round(num_missions * 0.35))
    n_in = int(round(num_missions * 0.35))
    n_mix = num_missions - n_out - n_in
    env_plan = np.array(["OUTDOOR"] * n_out + ["INDOOR"] * n_in + ["MIXED"] * n_mix)
    rng.shuffle(env_plan)
    profile_plan = rng.choice(["COMPACT", "STANDARD", "EXTENDED"], size=num_missions, p=[0.40, 0.36, 0.24])
    for m in range(num_missions):
        duration = int(rng.integers(5 * 60, 15 * 60 + 1))
        if m in low_batt_slots:
            # Long enough that a stressed relay can fall below 20% without starting low.
            duration = int(rng.integers(12 * 60, 15 * 60 + 1))
        freq = int(freq_plan[m])
        env = str(env_plan[m])
        profile = str(profile_plan[m])
        pos = _initial_positions(rng, profile)
        mode, speed, heading, waypoints, wp_index = _assign_movement(rng)
        bias, wall_db, wall_name, indoor = _pair_constants(rng, env)
        shadow = _symmetric_normal(rng, 3.5, (N_NODES, N_NODES))
        battery = rng.uniform(85.0, 100.0, size=N_NODES)
        battery[0] = 100.0
        drain_scale = np.ones(N_NODES, dtype=float)
        low_batt_node = None
        if m in low_batt_slots:
            low_batt_node = int(rng.integers(1, N_NODES))
            # Still starts in the normal 85–100% band. Faster drain carries it under 20%.
            drain_scale[low_batt_node] = float(rng.uniform(11.0, 14.0))
        events = _schedule_events(rng, m + 1, duration, mode) if m in event_slots else []
        plans.append({
            "mission_id": m + 1,
            "duration": duration,
            "frequency_mhz": freq,
            "environment": env,
            "pos": pos,
            "mode": mode,
            "speed": speed,
            "heading": heading,
            "waypoints": waypoints,
            "wp_index": wp_index,
            "pair_bias": bias,
            "wall_db": wall_db,
            "indoor": indoor,
            "shadow": shadow,
            "battery": battery,
            "drain_scale": drain_scale,
            "low_battery_node": NODE_NAMES[low_batt_node - 1] if low_batt_node else "",
            "deployment_profile": profile,
            "events": events,
        })
    return plans


def _active_event_loss(t, events, n=N_NODES):
    """Translate active events into extra loss, walls, offline mask, and indoor edits."""
    extra_loss = np.zeros((n, n), dtype=float)
    extra_walls = np.zeros(n, dtype=float)
    offline = np.zeros(n, dtype=bool)
    indoor_on = []
    indoor_off = []
    shadow_relax = []
    for ev in events:
        i = ev["node_index"]
        kind = ev["event_type"]
        if kind == "NODE ENTERS BUILDING" and t >= ev["start_second"]:
            indoor_on.append(i)
        elif kind == "NODE EXITS BUILDING" and t >= ev["start_second"]:
            indoor_off.append(i)
        if not (ev["start_second"] <= t <= ev["end_second"]):
            continue
        if kind == "NODE MOVES BEHIND WALL":
            extra_walls[i] += 2.0
        elif kind == "RELAY NODE FAILURE":
            offline[i] = True
        elif kind == "NODE TEMPORARILY DISCONNECTED":
            extra_loss[i, :] += 36.0
            extra_loss[:, i] += 36.0
        elif kind == "SUDDEN INTERFERENCE":
            extra_loss[i, :] += 16.0
            extra_loss[:, i] += 16.0
        elif kind == "ROUTE HANDOVER":
            extra_loss[i, 0] += 18.0
            extra_loss[0, i] += 18.0
        elif kind == "SIGNAL RECOVERY":
            shadow_relax.append(i)
    np.fill_diagonal(extra_loss, 0.0)
    return extra_loss, extra_walls, offline, indoor_on, indoor_off, shadow_relax


def simulate_missions(num_missions=NUM_MISSIONS, seed=SEED):
    """Generate the raw telemetry table and the mission/event catalogs."""
    rng = np.random.default_rng(seed)
    plans = _plan_missions(rng, num_missions)
    n_rows = sum(p["duration"] for p in plans) * len(NODE_NAMES)

    data = {col: np.empty(n_rows, dtype=object) for col in RAW_COLUMNS}
    float_cols = {
        "latitude", "longitude", "simulation_x", "simulation_y", "distance_to_gateway",
        "rssi_dbm", "pdr_percent", "latency_ms", "packet_loss_percent", "battery_level_percent",
        "sector_1_rssi", "sector_2_rssi", "sector_3_rssi", "sector_4_rssi",
        "predicted_link_quality", "actual_link_quality_score",
    }
    int_cols = {
        "mission_id", "timestamp", "frequency_mhz", "neighbor_count", "hop_count",
        "last_seen_seconds", "route_change",
    }
    for col in float_cols:
        data[col] = np.zeros(n_rows, dtype=float)
    for col in int_cols:
        data[col] = np.zeros(n_rows, dtype=int)

    cursor = 0
    mission_rows = []
    event_rows = []

    for plan in tqdm(plans, desc="Simulating missions"):
        pos = plan["pos"].copy()
        vel = np.zeros_like(pos)
        mode = plan["mode"]
        speed = plan["speed"].copy()
        heading = plan["heading"].copy()
        waypoints = plan["waypoints"].copy()
        wp_index = plan["wp_index"].copy()
        indoor = plan["indoor"].copy()
        shadow = plan["shadow"].copy()
        battery = plan["battery"].copy()
        events = plan["events"]
        freq = plan["frequency_mhz"]
        env = plan["environment"]
        duration = plan["duration"]

        prev_path = [None] * N_NODES
        pos_at_route = pos.copy()
        last_seen = np.zeros(N_NODES, dtype=int)
        change_hist = [np.zeros(30, dtype=int) for _ in range(N_NODES)]
        change_ptr = np.zeros(N_NODES, dtype=int)
        established = np.zeros(N_NODES, dtype=bool)
        battery_drop_applied = set()

        lat_scale = math.cos(math.radians(BASE_LAT))
        for ev in events:
            event_rows.append({k: ev[k] for k in ("mission_id", "node_id", "event_type", "start_second", "end_second", "notes")})

        for t in range(duration):
            extra_loss, extra_walls, offline, indoor_on, indoor_off, shadow_relax = _active_event_loss(t, events)
            for i in indoor_on:
                indoor[i] = True
            for i in indoor_off:
                indoor[i] = False
            for i in shadow_relax:
                shadow[i, :] *= 0.35
                shadow[:, i] *= 0.35
            for ev in events:
                if ev["event_type"] == "LOW BATTERY RELAY" and ev["start_second"] == t and ev["node_index"] not in battery_drop_applied:
                    i = ev["node_index"]
                    battery[i] = min(battery[i], float(rng.uniform(9.0, 18.0)))
                    battery_drop_applied.add(i)
            for i in range(1, N_NODES):
                if battery[i] <= 0.05:
                    offline[i] = True
                    battery[i] = 0.0

            _step_motion(pos, vel, mode, speed, heading, waypoints, wp_index, rng)

            delta = pos[None, :, :] - pos[:, None, :]
            distance = np.hypot(delta[:, :, 0], delta[:, :, 1])
            bearing = np.degrees(np.arctan2(delta[:, :, 1], delta[:, :, 0])) % 360.0
            sector_delta = sector_deltas_db(bearing)

            innov = _symmetric_normal(rng, 1.0, (N_NODES, N_NODES))
            shadow = 0.988 * shadow + math.sqrt(1.0 - 0.988 ** 2) * 3.6 * innov
            small = _symmetric_normal(rng, 1.05, (N_NODES, N_NODES))
            walls = _wall_count(distance, env, indoor, plan["pair_bias"], extra_walls)
            path_loss = _path_loss_matrix(distance, freq, env, walls, plan["wall_db"], shadow, small, indoor, extra_loss)
            rssi_sectors = _receive_rssi(path_loss, sector_delta)  # [rx, tx, sector]
            rssi_best = rssi_sectors.max(axis=-1)

            alive = ~offline
            alive[0] = True
            viable = (rssi_best >= RX_SENSITIVITY_DBM) & (rssi_best.T >= RX_SENSITIVITY_DBM) & alive[:, None] & alive[None, :]
            np.fill_diagonal(viable, False)

            bottleneck = np.minimum(rssi_best, rssi_best.T)
            # One-hop metrics on the bottleneck direction, shared by the undirected edge.
            pdr_edge = pdr_from_rssi(bottleneck, rng)
            pl_edge = packet_loss_from_pdr(pdr_edge, rng)
            lat_edge = hop_latency_ms(bottleneck, pl_edge, rng)
            cost = _edge_cost(bottleneck, pl_edge, lat_edge, battery, distance)
            cost = np.where(viable, cost, np.inf)

            topology_parts = []
            for i in range(N_NODES):
                for j in range(i + 1, N_NODES):
                    if viable[i, j]:
                        topology_parts.append(f"{ALL_NAMES[i]}-{ALL_NAMES[j]}")
            topology = "|".join(topology_parts)

            neighbor_idx = [np.flatnonzero(viable[i]).tolist() for i in range(N_NODES)]

            for local, node in enumerate(COMMANDO_INDEX):
                row = cursor + local
                nbrs = neighbor_idx[node]
                nbr_names = [ALL_NAMES[j] for j in nbrs]
                connected = "|".join(nbr_names)

                gw_rssi_sectors = rssi_sectors[node, 0]
                if offline[node]:
                    path = None
                    route, nxt, hops = "DISCONNECTED", "NONE", -1
                    sectors = gw_rssi_sectors.copy()
                    # Radio is off: report a floor, but keep the sector that faces the gateway strongest.
                    offset = sectors - sectors.max()
                    sectors = RSSI_FLOOR_DBM + offset
                    rssi = float(sectors.max())
                    pdr = 0.0
                    ploss = 100.0
                    latency = float(900.0 + abs(rng.normal(0.0, 25.0)))
                else:
                    best_path, best_cost = _dijkstra(cost, node, 0)
                    chosen = best_path
                    if established[node] and prev_path[node] is not None:
                        old_cost = _path_cost(cost, prev_path[node])
                        if np.isfinite(old_cost) and old_cost <= best_cost * 1.12 + 1.0:
                            chosen = prev_path[node]
                    path = chosen
                    route, nxt, hops = _format_route(path)
                    if path is None:
                        sectors = gw_rssi_sectors.copy()
                        rssi = float(sectors.max())
                        pdr = float(pdr_from_rssi(rssi, rng))
                        ploss = float(packet_loss_from_pdr(pdr, rng))
                        latency = float(420.0 + (100.0 - pdr) * 6.5 + abs(rng.normal(0.0, 18.0)))
                    else:
                        nh = path[1]
                        sectors = rssi_sectors[node, nh].copy()
                        rssi = float(sectors.max())
                        pdr = float(pdr_from_rssi(rssi, rng))
                        ploss = float(packet_loss_from_pdr(pdr, rng))
                        hop_lats = [float(lat_edge[path[a], path[a + 1]]) for a in range(len(path) - 1)]
                        raw_lat = float(np.sum(hop_lats))
                        # Sublinear extra cost so two hops are worse, but not exactly 2x.
                        latency = raw_lat * (1.0 + 0.07 * max(hops - 1, 0) ** 1.25)
                        latency += 1.1 * max(len(nbrs) - 1, 0)
                        latency += float(abs(rng.normal(0.0, 1.8)))

                obstacle = bool(extra_walls[node] > 0 or extra_loss[node].sum() > 0 or (not indoor[node] and env == "INDOOR"))
                direct_drop = False
                if prev_path[node] is not None and len(prev_path[node]) == 2 and path is not None and (len(path) != 2):
                    direct_drop = True
                if not established[node]:
                    changed, reason = 0, "NO_CHANGE"
                    established[node] = True
                else:
                    changed, reason = _reason_for_change(
                        prev_path[node], path, node, pos, pos_at_route, battery, offline, obstacle, direct_drop
                    )
                if changed:
                    pos_at_route[node] = pos[node].copy()
                prev_path[node] = path

                hist = change_hist[node]
                hist[int(change_ptr[node] % 30)] = changed
                change_ptr[node] += 1
                recent_changes = int(hist.sum())

                if path is not None and not offline[node]:
                    last_seen[node] = 0 if rng.random() > 0.08 else int(rng.integers(1, 3))
                else:
                    last_seen[node] += 1

                dist_gw = float(np.hypot(pos[node, 0] - pos[0, 0], pos[node, 1] - pos[0, 1]))
                score = float(link_quality_score(rssi, pdr, latency, ploss, hops, recent_changes, rng))
                label = quality_class(score)
                predicted = float(naive_predicted_quality(rssi, pdr, rng))

                if offline[node] or battery[node] <= 0.05:
                    status = "OFFLINE"
                elif path is None:
                    status = "DISCONNECTED"
                elif battery[node] < 20.0:
                    status = "LOW_BATTERY"
                elif rssi < -93.0 or pdr < 72.0:
                    status = "DEGRADED"
                else:
                    status = "ACTIVE"

                # Drain after the observation so this row still shows the pre-drain level,
                # and so the next second is strictly lower. Offline radios sit idle.
                if offline[node]:
                    drain = 0.00035
                else:
                    drain = 0.0032
                    drain += 0.0007 * len(nbrs)
                    drain += 0.0018 if path is not None else 0.0004
                    drain += 0.0055 * (ploss / 100.0)
                    drain += 0.0008 * float(speed[node])
                    if rssi < -90.0 and path is not None:
                        drain += 0.0016
                drain *= float(plan["drain_scale"][node])
                battery[node] = max(0.0, battery[node] - drain)

                active = int(np.argmax(sectors)) + 1
                data["mission_id"][row] = plan["mission_id"]
                data["timestamp"][row] = t
                data["node_id"][row] = NODE_NAMES[node - 1]
                data["latitude"][row] = BASE_LAT + pos[node, 1] / METERS_PER_DEGREE
                data["longitude"][row] = BASE_LON + pos[node, 0] / (METERS_PER_DEGREE * lat_scale)
                data["simulation_x"][row] = pos[node, 0]
                data["simulation_y"][row] = pos[node, 1]
                data["frequency_mhz"][row] = freq
                data["environment"][row] = env
                data["movement_state"][row] = mode[node]
                data["distance_to_gateway"][row] = dist_gw
                data["rssi_dbm"][row] = rssi
                data["pdr_percent"][row] = pdr
                data["latency_ms"][row] = latency
                data["packet_loss_percent"][row] = ploss
                data["battery_level_percent"][row] = battery[node]
                data["active_antenna_sector"][row] = f"Sector_{active}"
                data["sector_1_rssi"][row] = float(sectors[0])
                data["sector_2_rssi"][row] = float(sectors[1])
                data["sector_3_rssi"][row] = float(sectors[2])
                data["sector_4_rssi"][row] = float(sectors[3])
                data["connected_neighbors"][row] = connected
                data["neighbor_count"][row] = len(nbrs)
                data["next_hop"][row] = nxt
                data["selected_route"][row] = route
                data["hop_count"][row] = hops
                data["mesh_topology_snapshot"][row] = topology
                data["node_status"][row] = status
                data["last_seen_seconds"][row] = int(last_seen[node])
                data["route_change"][row] = changed
                data["route_change_reason"][row] = reason
                data["predicted_link_quality"][row] = predicted
                data["actual_link_quality_score"][row] = score
                data["link_quality_class"][row] = label

            cursor += len(COMMANDO_INDEX)

        mission_rows.append({
            "mission_id": plan["mission_id"],
            "frequency_mhz": freq,
            "environment": env,
            "duration_sec": duration,
            "event_count": len(events),
            "low_battery_node": plan["low_battery_node"],
            "deployment_profile": plan["deployment_profile"],
            "seed": seed,
        })

    df = pd.DataFrame(data)
    df = df.sort_values(["mission_id", "timestamp", "node_id"]).reset_index(drop=True)
    missions = pd.DataFrame(mission_rows)
    events_df = pd.DataFrame(event_rows)
    if events_df.empty:
        events_df = pd.DataFrame(columns=["mission_id", "node_id", "event_type", "start_second", "end_second", "notes"])
    return df, missions, events_df


# %% [markdown]
# ## Temporal features
#
# Rolling statistics are computed inside each `(mission_id, node_id)` series.
# A mission never contributes history to another mission.

# %%
def _time_since_change(series):
    values = series.to_numpy()
    ticks = np.arange(len(values))
    last = np.maximum.accumulate(np.where(values == 1, ticks, 0))
    return pd.Series(ticks - last, index=series.index)


def engineer_features(df):
    df = df.sort_values(["mission_id", "node_id", "timestamp"]).reset_index(drop=True)
    grouped = df.groupby(["mission_id", "node_id"], sort=False)

    df["previous_rssi"] = grouped["rssi_dbm"].shift(1)
    df["previous_rssi"] = df["previous_rssi"].fillna(df["rssi_dbm"])
    df["rssi_delta"] = df["rssi_dbm"] - df["previous_rssi"]
    df["rssi_rolling_mean_5s"] = grouped["rssi_dbm"].transform(lambda s: s.rolling(5, min_periods=1).mean())
    df["rssi_rolling_std_5s"] = grouped["rssi_dbm"].transform(lambda s: s.rolling(5, min_periods=1).std()).fillna(0.0)

    df["previous_pdr"] = grouped["pdr_percent"].shift(1)
    df["previous_pdr"] = df["previous_pdr"].fillna(df["pdr_percent"])
    df["pdr_delta"] = df["pdr_percent"] - df["previous_pdr"]
    df["pdr_rolling_mean_5s"] = grouped["pdr_percent"].transform(lambda s: s.rolling(5, min_periods=1).mean())

    df["previous_latency"] = grouped["latency_ms"].shift(1)
    df["previous_latency"] = df["previous_latency"].fillna(df["latency_ms"])
    df["latency_delta"] = df["latency_ms"] - df["previous_latency"]
    df["latency_rolling_mean_5s"] = grouped["latency_ms"].transform(lambda s: s.rolling(5, min_periods=1).mean())

    previous_battery = grouped["battery_level_percent"].shift(1)
    df["battery_delta"] = (df["battery_level_percent"] - previous_battery).fillna(0.0)

    df["route_changes_last_30s"] = grouped["route_change"].transform(lambda s: s.rolling(30, min_periods=1).sum())
    disconnected = df["node_status"].isin(["DISCONNECTED", "OFFLINE"]).astype(int)
    df["disconnects_last_30s"] = disconnected.groupby([df["mission_id"], df["node_id"]], sort=False).transform(
        lambda s: s.rolling(30, min_periods=1).sum()
    )

    sector_cols = ["sector_1_rssi", "sector_2_rssi", "sector_3_rssi", "sector_4_rssi"]
    df["mean_sector_rssi"] = df[sector_cols].mean(axis=1)
    df["max_sector_rssi"] = df[sector_cols].max(axis=1)
    df["min_sector_rssi"] = df[sector_cols].min(axis=1)
    df["sector_rssi_variance"] = df[sector_cols].var(axis=1)

    previous_distance = grouped["distance_to_gateway"].shift(1)
    df["distance_delta"] = (df["distance_to_gateway"] - previous_distance).fillna(0.0)
    previous_neighbors = grouped["neighbor_count"].shift(1)
    df["neighbor_count_delta"] = (df["neighbor_count"] - previous_neighbors).fillna(0.0)
    df["time_since_route_change"] = grouped["route_change"].transform(_time_since_change)
    return df


def mission_split(df, seed=SEED):
    """70 / 15 / 15 split by mission, so one mission stays in a single split."""
    rng = np.random.default_rng(seed)
    missions = df["mission_id"].drop_duplicates().to_numpy().copy()
    rng.shuffle(missions)
    n = len(missions)
    n_train = int(round(n * 0.70))
    n_val = int(round(n * 0.15))
    train_ids = set(missions[:n_train].tolist())
    val_ids = set(missions[n_train:n_train + n_val].tolist())
    split = np.full(len(df), "test", dtype=object)
    split[df["mission_id"].isin(train_ids).to_numpy()] = "train"
    split[df["mission_id"].isin(val_ids).to_numpy()] = "val"
    # With 100 missions this is 70 / 15 / 15. Other counts stay proportional.
    if n == 100:
        train_ids = set(missions[:70].tolist())
        val_ids = set(missions[70:85].tolist())
        split[:] = "test"
        split[df["mission_id"].isin(train_ids).to_numpy()] = "train"
        split[df["mission_id"].isin(val_ids).to_numpy()] = "val"
    out = df.copy()
    out["split"] = split
    return out


def build_ml_frame(df):
    """Numeric training frame. Identifiers and route strings are left out."""
    ml = mission_split(df)
    env = pd.get_dummies(ml["environment"], prefix="environment")
    move = pd.get_dummies(ml["movement_state"], prefix="movement")
    ml = pd.concat([ml, env, move], axis=1)
    ml["active_antenna_sector_id"] = ml["active_antenna_sector"].str.extract(r"(\d+)").astype(int)

    feature_cols = [
        "rssi_dbm",
        "pdr_percent",
        "latency_ms",
        "packet_loss_percent",
        "battery_level_percent",
        "distance_to_gateway",
        "hop_count",
        "neighbor_count",
        "frequency_mhz",
        "active_antenna_sector_id",
        "sector_1_rssi",
        "sector_2_rssi",
        "sector_3_rssi",
        "sector_4_rssi",
        "previous_rssi",
        "rssi_delta",
        "rssi_rolling_mean_5s",
        "rssi_rolling_std_5s",
        "previous_pdr",
        "pdr_delta",
        "pdr_rolling_mean_5s",
        "previous_latency",
        "latency_delta",
        "latency_rolling_mean_5s",
        "battery_delta",
        "route_changes_last_30s",
        "disconnects_last_30s",
        "mean_sector_rssi",
        "max_sector_rssi",
        "min_sector_rssi",
        "sector_rssi_variance",
        "distance_delta",
        "neighbor_count_delta",
        "time_since_route_change",
    ]
    feature_cols.extend(list(env.columns))
    feature_cols.extend(list(move.columns))
    keep = feature_cols + ["actual_link_quality_score", "link_quality_class", "split"]
    return ml[keep].copy(), feature_cols


# %% [markdown]
# ## Validation
#
# These checks confirm ranges, monotonic battery drain, route integrity,
# and that offline radios are absent from the mesh.

# %%
def _neighbors_of(value):
    if not isinstance(value, str) or value == "":
        return set()
    return set(value.split("|"))


def validate_dataset(df):
    """Run integrity checks and print PASS or FAIL for each one."""
    results = []

    def check(name, ok, detail):
        results.append((name, bool(ok), detail))
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")

    pdr_ok = df["pdr_percent"].between(0, 100).all()
    check("PDR in [0, 100]", pdr_ok, f"min={df['pdr_percent'].min():.2f} max={df['pdr_percent'].max():.2f}")

    bat_ok = df["battery_level_percent"].between(0, 100).all()
    check("Battery in [0, 100]", bat_ok, f"min={df['battery_level_percent'].min():.2f} max={df['battery_level_percent'].max():.2f}")

    loss_ok = df["packet_loss_percent"].between(0, 100).all()
    check("Packet loss in [0, 100]", loss_ok, f"min={df['packet_loss_percent'].min():.2f} max={df['packet_loss_percent'].max():.2f}")

    hop_ok = df["hop_count"].between(-1, 6).all()
    check("Hop count valid", hop_ok, f"min={df['hop_count'].min()} max={df['hop_count'].max()}")

    ordered = df.groupby(["mission_id", "node_id"], sort=False)["timestamp"].diff().dropna()
    order_ok = bool((ordered == 1).all())
    check("Timestamps increase by 1 s inside each node mission", order_ok, f"bad_steps={(ordered != 1).sum()}")

    battery_step = df.groupby(["mission_id", "node_id"], sort=False)["battery_level_percent"].diff().dropna()
    # A few thousandths of a percent of float noise is acceptable; real increases are not.
    batt_ok = bool((battery_step <= 0.02).all())
    check("Battery never increases inside a node mission", batt_ok, f"max_step={battery_step.max():.4f}")

    sectors_ok = df["active_antenna_sector"].isin(["Sector_1", "Sector_2", "Sector_3", "Sector_4"]).all()
    check("Active antenna is one of four sectors", sectors_ok, str(sorted(df["active_antenna_sector"].unique())))

    connected = df["hop_count"] >= 0
    route_end_ok = True
    next_ok = True
    loop_ok = True
    disconnected_quiet = True
    sample_bad = ""
    for route, nxt, hops, node, nbrs, status in zip(
        df.loc[connected, "selected_route"],
        df.loc[connected, "next_hop"],
        df.loc[connected, "hop_count"],
        df.loc[connected, "node_id"],
        df.loc[connected, "connected_neighbors"],
        df.loc[connected, "node_status"],
    ):
        parts = str(route).split(">")
        if not parts or parts[-1] != "Gateway" or parts[0] != node or len(parts) - 1 != int(hops):
            route_end_ok = False
            sample_bad = str(route)
            break
        if len(parts) != len(set(parts)):
            loop_ok = False
            sample_bad = str(route)
            break
        if nxt not in _neighbors_of(nbrs) or nxt != parts[1]:
            next_ok = False
            sample_bad = f"{nxt} not in {nbrs}"
            break
        if status in ("DISCONNECTED", "OFFLINE"):
            disconnected_quiet = False
            sample_bad = status
            break
    check("Selected route reaches Gateway without loops", route_end_ok and loop_ok, sample_bad or "routes end at Gateway")
    check("next_hop is the second hop and a connected neighbour", next_ok, sample_bad or "next hop is on the neighbour list")
    check("Disconnected and offline nodes do not route", disconnected_quiet, sample_bad or "no routed packets while down")

    disc = df["hop_count"] < 0
    disc_ok = (
        (df.loc[disc, "next_hop"] == "NONE").all()
        and (df.loc[disc, "selected_route"] == "DISCONNECTED").all()
        and df.loc[disc, "node_status"].isin(["DISCONNECTED", "OFFLINE"]).all()
    )
    check("No-route rows are marked DISCONNECTED", disc_ok, f"count={int(disc.sum())}")

    # Offline radios must not appear in anybody's neighbour list at that instant.
    offline_pairs = df.loc[df["node_status"] == "OFFLINE", ["mission_id", "timestamp", "node_id"]]
    mesh = df[["mission_id", "timestamp", "connected_neighbors"]]
    merged = mesh.merge(offline_pairs, on=["mission_id", "timestamp"], how="inner")
    if merged.empty:
        leak = 0
    else:
        leak = int(merged.apply(lambda r: r["node_id"] in _neighbors_of(r["connected_neighbors"]), axis=1).sum())
    check("Offline nodes are excluded from the mesh", leak == 0, f"leak_count={leak}")

    rssi_live = df.loc[df["node_status"] != "OFFLINE", "rssi_dbm"]
    in_band = float(rssi_live.between(-110, -35).mean()) if len(rssi_live) else 1.0
    floor_ok = float(rssi_live.min()) >= RSSI_FLOOR_DBM - 0.01 if len(rssi_live) else True
    check(
        "RSSI stays inside the radio range and most live values are between -110 and -35 dBm",
        in_band > 0.80 and floor_ok and float(rssi_live.max()) <= RSSI_CEILING_DBM + 0.01,
        f"fraction_in_band={in_band:.3f} min={rssi_live.min():.1f} median={rssi_live.median():.1f} max={rssi_live.max():.1f}",
    )

    print("\nClass distribution:")
    class_pct = df["link_quality_class"].value_counts(normalize=True).reindex(
        ["EXCELLENT", "GOOD", "DEGRADED", "CRITICAL", "FAILED"]
    ).fillna(0.0) * 100.0
    print(class_pct.round(2).to_string())
    print("\nRoute-change share: {:.2f}%".format(100.0 * df["route_change"].mean()))
    print("NO_CHANGE share: {:.2f}%".format(100.0 * (df["route_change_reason"] == "NO_CHANGE").mean()))
    return results


# %% [markdown]
# ## Plots
#
# Scatter plots use a sample so the figure stays readable. The single-mission
# figure shows trajectories, mesh links at a few instants, and route changes.

# %%
def make_plots(df, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="darkgrid")
    sample = df.sample(n=min(12000, len(df)), random_state=SEED)
    live = sample[sample["node_status"] != "OFFLINE"]

    fig, axes = plt.subplots(5, 2, figsize=(16, 22))
    sns.scatterplot(data=live, x="distance_to_gateway", y="rssi_dbm", hue="environment", s=12, alpha=0.35, ax=axes[0, 0], legend=False)
    axes[0, 0].set_title("RSSI vs distance to gateway")
    sns.scatterplot(data=live, x="rssi_dbm", y="pdr_percent", s=12, alpha=0.3, ax=axes[0, 1], color="#1f77b4")
    axes[0, 1].set_title("RSSI vs PDR")
    sns.scatterplot(data=live, x="rssi_dbm", y="latency_ms", s=12, alpha=0.3, ax=axes[1, 0], color="#ff7f0e")
    axes[1, 0].set_title("RSSI vs latency")
    hop_df = live[live["hop_count"] > 0]
    sns.boxplot(data=hop_df, x="hop_count", y="latency_ms", ax=axes[1, 1], color="#aec7e8")
    axes[1, 1].set_title("Hop count vs latency")

    mission_for_battery = int(df["mission_id"].iloc[0])
    batt = df[df["mission_id"] == mission_for_battery]
    sns.lineplot(data=batt, x="timestamp", y="battery_level_percent", hue="node_id", ax=axes[2, 0])
    axes[2, 0].set_title(f"Battery vs mission time (mission {mission_for_battery})")
    sns.histplot(df["actual_link_quality_score"], bins=40, ax=axes[2, 1], color="#2ca02c")
    axes[2, 1].set_title("Link quality distribution")
    sns.boxplot(data=sample, x="environment", y="actual_link_quality_score", ax=axes[3, 0], color="#98df8a")
    axes[3, 0].set_title("Link quality by environment")
    sns.boxplot(data=sample, x="frequency_mhz", y="actual_link_quality_score", ax=axes[3, 1], color="#c5b0d5")
    axes[3, 1].set_title("Link quality by frequency")

    route_time = df.groupby("timestamp", as_index=False)["route_change"].mean()
    sns.lineplot(data=route_time, x="timestamp", y="route_change", ax=axes[4, 0], color="#d62728")
    axes[4, 0].set_title("Route-change rate over mission time")
    axes[4, 0].set_ylabel("Fraction of nodes changing route")
    corr_cols = ["distance_to_gateway", "rssi_dbm", "pdr_percent", "packet_loss_percent", "latency_ms", "hop_count", "battery_level_percent", "actual_link_quality_score"]
    sns.heatmap(sample[corr_cols].corr(), annot=True, fmt=".2f", cmap="coolwarm", ax=axes[4, 1], annot_kws={"size": 7})
    axes[4, 1].set_title("Correlation matrix")
    fig.tight_layout()
    fig.savefig(out_dir / "exploratory_plots.png", dpi=120)
    plt.close(fig)

    # One mission with movement, links, and route changes.
    change_counts = df.groupby("mission_id")["route_change"].sum().sort_values(ascending=False)
    mission_id = int(change_counts.index[0])
    mdf = df[df["mission_id"] == mission_id]
    times = np.linspace(mdf["timestamp"].min(), mdf["timestamp"].max(), 4).astype(int)

    fig, axes = plt.subplots(2, 3, figsize=(16, 10))
    ax = axes[0, 0]
    for node, g in mdf.groupby("node_id"):
        ax.plot(g["simulation_x"], g["simulation_y"], label=node, linewidth=1.2)
    ax.scatter([250], [250], marker="*", s=220, c="black", label="Gateway", zorder=5)
    ax.set_xlim(0, AREA_M)
    ax.set_ylim(0, AREA_M)
    ax.set_title(f"Mission {mission_id} trajectories")
    ax.set_aspect("equal")
    ax.legend(fontsize=7, loc="upper right")

    for ax, t in zip(axes.flat[1:5], times):
        snap = mdf[mdf["timestamp"] == int(t)]
        ax.scatter([250], [250], marker="*", s=160, c="black", zorder=5)
        ax.scatter(snap["simulation_x"], snap["simulation_y"], c="#1f77b4", s=40, zorder=4)
        for _, row in snap.iterrows():
            ax.text(row["simulation_x"] + 4, row["simulation_y"] + 4, row["node_id"].replace("Node_", ""), fontsize=7)
        topo = str(snap["mesh_topology_snapshot"].iloc[0]) if len(snap) else ""
        coords = {GATEWAY_NAME: (250.0, 250.0)}
        coords.update({r["node_id"]: (r["simulation_x"], r["simulation_y"]) for _, r in snap.iterrows()})
        if topo:
            for edge in topo.split("|"):
                a, b = edge.split("-")
                if a in coords and b in coords:
                    ax.plot([coords[a][0], coords[b][0]], [coords[a][1], coords[b][1]], color="0.6", linewidth=0.8, zorder=1)
        for _, row in snap.iterrows():
            if row["next_hop"] == "NONE":
                continue
            a = coords[row["node_id"]]
            b = coords.get(row["next_hop"])
            if b is None:
                continue
            ax.annotate("", xy=b, xytext=a, arrowprops=dict(arrowstyle="->", color="#d62728", lw=1.2))
        ax.set_xlim(0, AREA_M)
        ax.set_ylim(0, AREA_M)
        ax.set_aspect("equal")
        ax.set_title(f"t = {int(t)} s  (grey link, red route)")

    ax = axes[1, 2]
    for node, g in mdf.groupby("node_id"):
        changes = g[g["route_change"] == 1]
        ax.scatter(changes["timestamp"], [node] * len(changes), s=18)
    ax.set_title("Route changes over time")
    ax.set_xlabel("timestamp (s)")
    fig.tight_layout()
    fig.savefig(out_dir / "mission_mesh_timeline.png", dpi=120)
    plt.close(fig)
    print(f"Saved plots to {out_dir}")
    return mission_id


# %% [markdown]
# ## Export and XGBoost split
#
# Training rows are split by mission: 70 train, 15 validation, 15 test when
# 100 missions are generated. `mission_id`, `node_id`, `selected_route`, and
# `next_hop` are not model features.

# %%
def export_dataset(df_raw, df_features, missions, events, out_dir: Path, feature_cols):
    out_dir.mkdir(parents=True, exist_ok=True)
    ml, cols = build_ml_frame(df_features)
    # build_ml_frame already returns the training table; feature_cols is recomputed
    # so the summary matches the file exactly.
    feature_cols = cols

    raw_path = out_dir / "mesh_telemetry_raw.csv"
    ml_path = out_dir / "mesh_telemetry_ml_ready.csv"
    df_raw.to_csv(raw_path, index=False)
    ml.to_csv(ml_path, index=False)
    missions.to_csv(out_dir / "missions.csv", index=False)
    events.to_csv(out_dir / "events.csv", index=False)

    class_share = df_raw["link_quality_class"].value_counts(normalize=True).to_dict()
    freq_share = df_raw["frequency_mhz"].value_counts(normalize=True).to_dict()
    env_share = df_raw["environment"].value_counts(normalize=True).to_dict()
    missions_with_events = int((missions["event_count"] > 0).sum()) if "event_count" in missions else int(events["mission_id"].nunique())
    summary = {
        "number_of_missions": int(missions["mission_id"].nunique()),
        "number_of_rows": int(len(df_raw)),
        "number_of_nodes": int(df_raw["node_id"].nunique()),
        "random_seed": SEED,
        "class_distribution": {k: float(v) for k, v in class_share.items()},
        "frequency_distribution": {str(k): float(v) for k, v in freq_share.items()},
        "environment_distribution": {str(k): float(v) for k, v in env_share.items()},
        "average_rssi": float(df_raw["rssi_dbm"].mean()),
        "average_pdr": float(df_raw["pdr_percent"].mean()),
        "average_latency": float(df_raw["latency_ms"].mean()),
        "average_battery": float(df_raw["battery_level_percent"].mean()),
        "route_changes": int(df_raw["route_change"].sum()),
        "disconnect_events": int(df_raw["node_status"].isin(["DISCONNECTED", "OFFLINE"]).sum()),
        "missions_with_events": missions_with_events,
        "train_rows": int((ml["split"] == "train").sum()),
        "validation_rows": int((ml["split"] == "val").sum()),
        "test_rows": int((ml["split"] == "test").sum()),
        "feature_columns": feature_cols,
        "excluded_from_features": ["mission_id", "node_id", "selected_route", "next_hop"],
        "frequency_note": "65 MHz and 1200 MHz are prototype simulation configurations, not claimed NSG operating frequencies.",
        "coordinate_note": "Latitude and longitude are fictional visualization offsets around 12.9716, 77.5946. They are not NSG deployment locations.",
        "target": "actual_link_quality_score",
    }
    with (out_dir / "synthetic_data_summary.json").open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
    return ml, summary


def main(num_missions=NUM_MISSIONS, out_dir="data", skip_plots=False):
    out = Path(out_dir)
    print(f"Generating {num_missions} missions with seed {SEED}")
    print("Frequencies 65 and 1200 MHz are prototype simulation configurations, not NSG operating frequencies.")
    print("Coordinates are fictional visualization points, not deployment locations.")
    df_raw, missions, events = simulate_missions(num_missions=num_missions, seed=SEED)
    print(f"Raw rows: {len(df_raw)}")
    df_features = engineer_features(df_raw)
    print("--- DATA VALIDATION ---")
    results = validate_dataset(df_features)
    if not skip_plots:
        make_plots(df_features, out / "figures")
    ml, summary = export_dataset(df_raw, df_features, missions, events, out, feature_cols=[])
    print(json.dumps({k: summary[k] for k in [
        "number_of_missions", "number_of_rows", "number_of_nodes", "class_distribution",
        "frequency_distribution", "environment_distribution", "average_rssi", "average_pdr",
        "average_latency", "average_battery", "route_changes", "disconnect_events",
        "missions_with_events",
    ]}, indent=2))
    failed = [name for name, ok, _ in results if not ok]
    if failed:
        print("VALIDATION FAILURES:", ", ".join(failed))
    print("DATASET GENERATED SUCCESSFULLY")
    print(df_raw.head(20).to_string(index=False))
    return df_raw, df_features, ml, summary


# %%
def _in_notebook():
    try:
        get_ipython()  # noqa: F821
        return True
    except NameError:
        return False


if __name__ == "__main__" and not _in_notebook():
    parser = argparse.ArgumentParser(description="Generate the synthetic mesh telemetry dataset")
    parser.add_argument("--missions", type=int, default=NUM_MISSIONS)
    parser.add_argument("--out-dir", default="data")
    parser.add_argument("--skip-plots", action="store_true")
    args = parser.parse_args()
    main(num_missions=args.missions, out_dir=args.out_dir, skip_plots=args.skip_plots)
elif _in_notebook():
    main()
