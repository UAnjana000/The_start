import numpy as np
import pandas as pd
import networkx as nx
import random
import math
import json
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from tqdm import tqdm
import warnings
warnings.filterwarnings('ignore')

# Constants
SEED = 42
np.random.seed(SEED)
random.seed(SEED)

NUM_MISSIONS = 100
NODES = ['Node_A', 'Node_B', 'Node_C', 'Node_D', 'Node_E', 'Node_F']
GATEWAY = 'Gateway'
ALL_NODES = [GATEWAY] + NODES

# Frequencies and Environments
FREQUENCIES = [865, 1200]
ENVIRONMENTS = ['OUTDOOR', 'INDOOR', 'MIXED']
ENV_PROBS = [0.35, 0.35, 0.30]

# Coordinates
BASE_LAT = 12.97
BASE_LON = 77.59
METERS_PER_DEGREE = 111320.0

# Radio Params
TX_POWER = 20 # dBm
TX_GAIN = 2 # dBi
RX_GAIN = 2 # dBi
SENSITIVITY = -110 # dBm

# Walls
WALL_MATERIALS = {'WOOD': (3, 5), 'GLASS': (2, 4), 'BRICK': (5, 8), 'CONCRETE': (8, 12)}

# Movement
MOVEMENT_MODES = ['STATIC', 'WALKING', 'PATROL', 'RANDOM_WALK']

def calculate_fspl(distance_m, freq_mhz):
    distance_km = max(distance_m, 1.0) / 1000.0
    return 32.44 + 20 * math.log10(distance_km) + 20 * math.log10(freq_mhz)

def calculate_rssi(distance_m, freq_mhz, env, walls, wall_loss_db, shadow_fading):
    fspl = calculate_fspl(distance_m, freq_mhz)
    
    env_loss = 0
    if env == 'INDOOR':
        env_loss = 10
    elif env == 'MIXED':
        env_loss = 5
        
    total_path_loss = fspl + env_loss + (walls * wall_loss_db) + shadow_fading
    rssi = TX_POWER + TX_GAIN + RX_GAIN - total_path_loss
    return max(min(rssi, -35), -120)

def calculate_pdr(rssi):
    if rssi >= -65:
        base_pdr = 99.0
    elif rssi >= -85:
        base_pdr = 90.0 + (rssi + 85) * (9.0 / 20.0)
    elif rssi >= -100:
        base_pdr = 50.0 + (rssi + 100) * (40.0 / 15.0)
    elif rssi >= SENSITIVITY:
        base_pdr = 10.0 + (rssi - SENSITIVITY) * (40.0 / 10.0)
    else:
        base_pdr = 0.0
        
    noise = random.uniform(-2, 2)
    return max(0.0, min(100.0, base_pdr + noise))

def calculate_latency(rssi, pdr, hop_count):
    base_latency = random.uniform(15, 30)
    hop_penalty = hop_count * random.uniform(10, 20)
    
    packet_loss = 100.0 - pdr
    retransmission_penalty = (packet_loss / 10.0) * random.uniform(20, 50)
    
    rssi_penalty = 0
    if rssi < -85:
        rssi_penalty = (-85 - rssi) * 2
        
    jitter = random.uniform(0, 5)
    
    return base_latency + hop_penalty + retransmission_penalty + rssi_penalty + jitter

def calculate_link_quality(rssi, pdr, latency, packet_loss, hop_count, route_changes_recent):
    norm_rssi = max(0, min(100, (rssi - SENSITIVITY) / (-35 - SENSITIVITY) * 100))
    norm_pdr = pdr
    inv_latency = max(0, min(100, 100 - (latency / 5.0)))
    inv_pl = max(0, 100 - packet_loss)
    route_stability = max(0, 100 - (route_changes_recent * 20))
    
    quality = (0.35 * norm_rssi) + (0.30 * norm_pdr) + (0.15 * inv_latency) + (0.10 * inv_pl) + (0.10 * route_stability)
    noise = random.uniform(-3, 3)
    quality = max(0, min(100, quality + noise))
    return quality

def get_quality_class(score):
    if score >= 90: return 'EXCELLENT'
    elif score >= 75: return 'GOOD'
    elif score >= 50: return 'DEGRADED'
    elif score >= 25: return 'CRITICAL'
    else: return 'FAILED'

data_records = []
events_records = []
missions_records = []

for mission_id in tqdm(range(1, NUM_MISSIONS + 1), desc='Simulating Missions'):
    freq = random.choice(FREQUENCIES)
    env = np.random.choice(ENVIRONMENTS, p=ENV_PROBS)
    duration_sec = random.randint(5 * 60, 15 * 60)
    
    has_event = random.random() < 0.15
    event_type = None
    event_time = -1
    event_node = None
    if has_event:
        event_type = random.choice(['NODE MOVES BEHIND WALL', 'NODE ENTERS BUILDING', 'NODE EXITS BUILDING', 
                                    'RELAY NODE FAILURE', 'LOW BATTERY RELAY', 'NODE TEMPORARILY DISCONNECTED', 
                                    'SIGNAL RECOVERY', 'SUDDEN INTERFERENCE', 'ROUTE HANDOVER'])
        event_time = random.randint(int(duration_sec * 0.2), int(duration_sec * 0.8))
        event_node = random.choice(NODES)
        events_records.append({'mission_id': mission_id, 'event_type': event_type, 'time': event_time, 'node': event_node})
    
    missions_records.append({'mission_id': mission_id, 'frequency_mhz': freq, 'environment': env, 'duration_sec': duration_sec})
    
    # Initialize nodes
    node_states = {}
    for node in ALL_NODES:
        node_states[node] = {
            'x': random.uniform(0, 500) if node != GATEWAY else 250.0,
            'y': random.uniform(0, 500) if node != GATEWAY else 250.0,
            'battery': random.uniform(85, 100),
            'mode': random.choice(MOVEMENT_MODES) if node != GATEWAY else 'STATIC',
            'target_x': random.uniform(0, 500),
            'target_y': random.uniform(0, 500),
            'speed': random.uniform(0.5, 2.0),
            'status': 'ACTIVE',
            'last_seen': 0,
            'route': '',
            'route_changes_recent': 0
        }
        
    for t in range(duration_sec):
        # Handle events
        if t == event_time and event_node:
            if event_type == 'RELAY NODE FAILURE':
                node_states[event_node]['status'] = 'OFFLINE'
                node_states[event_node]['battery'] = 0
            elif event_type == 'LOW BATTERY RELAY':
                node_states[event_node]['battery'] = 19.0
                node_states[event_node]['status'] = 'LOW_BATTERY'
            elif event_type == 'NODE TEMPORARILY DISCONNECTED':
                node_states[event_node]['x'] = 10000 # move far away
            elif event_type == 'SIGNAL RECOVERY':
                node_states[event_node]['x'] = 250
                node_states[event_node]['y'] = 250

        # Update positions
        for node in NODES:
            if node_states[node]['status'] == 'OFFLINE': continue
            if node_states[node]['mode'] != 'STATIC':
                dx = node_states[node]['target_x'] - node_states[node]['x']
                dy = node_states[node]['target_y'] - node_states[node]['y']
                dist = math.hypot(dx, dy)
                if dist < 2.0:
                    node_states[node]['target_x'] = random.uniform(0, 500)
                    node_states[node]['target_y'] = random.uniform(0, 500)
                else:
                    node_states[node]['x'] += (dx / dist) * node_states[node]['speed']
                    node_states[node]['y'] += (dy / dist) * node_states[node]['speed']
                    
        # Build network graph
        G = nx.Graph()
        for n in ALL_NODES:
            if node_states[n]['status'] != 'OFFLINE':
                G.add_node(n)
                
        link_metrics = {}
        for i in range(len(ALL_NODES)):
            for j in range(i + 1, len(ALL_NODES)):
                n1, n2 = ALL_NODES[i], ALL_NODES[j]
                if node_states[n1]['status'] == 'OFFLINE' or node_states[n2]['status'] == 'OFFLINE': continue
                
                dist = math.hypot(node_states[n1]['x'] - node_states[n2]['x'], node_states[n1]['y'] - node_states[n2]['y'])
                
                walls = 0
                wall_loss = 0
                if env == 'INDOOR' or (env == 'MIXED' and random.random() < 0.5):
                    walls = random.randint(0, 5)
                    wall_material = random.choice(list(WALL_MATERIALS.keys()))
                    wall_loss = random.uniform(*WALL_MATERIALS[wall_material])
                    
                if t >= event_time and event_node in [n1, n2]:
                    if event_type == 'NODE MOVES BEHIND WALL':
                        walls += 2
                        wall_loss = 8
                    elif event_type == 'SUDDEN INTERFERENCE':
                        wall_loss += 15
                        
                shadow_fading = random.gauss(0, 4)
                rssi = calculate_rssi(dist, freq, env, walls, wall_loss, shadow_fading)
                
                if rssi >= SENSITIVITY:
                    pdr = calculate_pdr(rssi)
                    packet_loss = max(0.0, min(100.0, 100.0 - pdr + random.uniform(-2, 2)))
                    
                    # Edge cost
                    rssi_penalty = max(0, -50 - rssi)
                    battery_penalty = 0
                    if node_states[n1]['battery'] < 30: battery_penalty += 20
                    if node_states[n2]['battery'] < 30: battery_penalty += 20
                    
                    cost = (0.30 * rssi_penalty) + (0.30 * packet_loss) + (0.10 * battery_penalty) + (0.10 * (dist/100.0))
                    G.add_edge(n1, n2, weight=cost, rssi=rssi, pdr=pdr, pl=packet_loss, dist=dist)
                    link_metrics[(n1, n2)] = {'rssi': rssi, 'pdr': pdr, 'pl': packet_loss, 'dist': dist}
                    link_metrics[(n2, n1)] = link_metrics[(n1, n2)]
                    
        # Routing and Telemetry
        topology_snapshot = "|".join([f"{u}-{v}" for u, v in G.edges()])
        
        for node in NODES:
            if node_states[node]['status'] == 'OFFLINE': continue
            
            neighbors = list(G.neighbors(node)) if node in G else []
            connected_neighbors = "|".join(neighbors)
            neighbor_count = len(neighbors)
            
            # Routing
            selected_route = 'DISCONNECTED'
            next_hop = 'NONE'
            hop_count = -1
            route_change = 0
            route_change_reason = 'NO_CHANGE'
            
            if node in G and nx.has_path(G, node, GATEWAY):
                path = nx.shortest_path(G, source=node, target=GATEWAY, weight='weight')
                selected_route = ">".join(path)
                next_hop = path[1]
                hop_count = len(path) - 1
                node_states[node]['last_seen'] = 0
                if node_states[node]['status'] == 'DISCONNECTED':
                    node_states[node]['status'] = 'ACTIVE'
                    route_change_reason = 'RECONNECTED'
                    route_change = 1
            else:
                node_states[node]['last_seen'] += 1
                if node_states[node]['status'] != 'LOW_BATTERY':
                    node_states[node]['status'] = 'DISCONNECTED'
                    
            if selected_route != node_states[node]['route'] and route_change_reason == 'NO_CHANGE':
                route_change = 1
                if selected_route == 'DISCONNECTED':
                    route_change_reason = 'NODE_FAILURE' if neighbor_count == 0 else 'OBSTACLE_LOSS'
                else:
                    route_change_reason = random.choice(['BETTER_NEIGHBOR_AVAILABLE', 'DIRECT_LINK_WEAK', 'NODE_MOVED'])
            
            node_states[node]['route'] = selected_route
            if route_change:
                node_states[node]['route_changes_recent'] = min(10, node_states[node]['route_changes_recent'] + 1)
            else:
                node_states[node]['route_changes_recent'] = max(0, node_states[node]['route_changes_recent'] - 0.1)
                
            # Link metrics to next hop
            rssi = -120
            pdr = 0.0
            pl = 100.0
            dist_to_gw = math.hypot(node_states[node]['x'] - node_states[GATEWAY]['x'], node_states[node]['y'] - node_states[GATEWAY]['y'])
            
            if next_hop != 'NONE':
                metrics = link_metrics[(node, next_hop)]
                rssi = metrics['rssi']
                pdr = metrics['pdr']
                pl = metrics['pl']
                
            latency = calculate_latency(rssi, pdr, hop_count) if hop_count > 0 else 0
            
            # Antenna Sectors
            sectors = [rssi - random.uniform(5, 20) for _ in range(4)]
            best_sector = random.randint(0, 3)
            sectors[best_sector] = rssi + random.uniform(1, 3)
            
            # Battery drain
            drain = 0.005
            if next_hop != 'NONE': drain += 0.002
            if pl > 10: drain += 0.003 # retransmissions
            node_states[node]['battery'] = max(0.0, node_states[node]['battery'] - drain)
            
            if node_states[node]['battery'] < 20 and node_states[node]['status'] == 'ACTIVE':
                node_states[node]['status'] = 'LOW_BATTERY'
            if node_states[node]['battery'] == 0:
                node_states[node]['status'] = 'OFFLINE'
                
            # Target variable
            actual_lq = calculate_link_quality(rssi, pdr, latency, pl, hop_count, node_states[node]['route_changes_recent']) if hop_count > 0 else 0.0
            lq_class = get_quality_class(actual_lq)
            
            lat = BASE_LAT + (node_states[node]['y'] / METERS_PER_DEGREE)
            lon = BASE_LON + (node_states[node]['x'] / (METERS_PER_DEGREE * math.cos(math.radians(BASE_LAT))))
            
            record = {
                'mission_id': mission_id,
                'timestamp': t,
                'node_id': node,
                'latitude': lat,
                'longitude': lon,
                'simulation_x': node_states[node]['x'],
                'simulation_y': node_states[node]['y'],
                'frequency_mhz': freq,
                'environment': env,
                'movement_state': node_states[node]['mode'],
                'distance_to_gateway': dist_to_gw,
                'rssi_dbm': rssi,
                'pdr_percent': pdr,
                'latency_ms': latency,
                'packet_loss_percent': pl,
                'battery_level_percent': node_states[node]['battery'],
                'active_antenna_sector': f'Sector_{best_sector + 1}',
                'sector_1_rssi': sectors[0],
                'sector_2_rssi': sectors[1],
                'sector_3_rssi': sectors[2],
                'sector_4_rssi': sectors[3],
                'connected_neighbors': connected_neighbors,
                'neighbor_count': neighbor_count,
                'next_hop': next_hop,
                'selected_route': selected_route,
                'hop_count': hop_count,
                'mesh_topology_snapshot': topology_snapshot,
                'node_status': node_states[node]['status'],
                'last_seen_seconds': node_states[node]['last_seen'],
                'route_change': route_change,
                'route_change_reason': route_change_reason,
                'predicted_link_quality': actual_lq, # Placeholder for inference
                'actual_link_quality_score': actual_lq,
                'link_quality_class': lq_class
            }
            data_records.append(record)

df_raw = pd.DataFrame(data_records)
df_events = pd.DataFrame(events_records)
df_missions = pd.DataFrame(missions_records)
print(f"Generated {len(df_raw)} rows of raw telemetry.")

def engineer_features(df):
    df = df.sort_values(['mission_id', 'node_id', 'timestamp']).copy()
    
    # Group by mission and node to prevent leakage
    grouped = df.groupby(['mission_id', 'node_id'])
    
    df['previous_rssi'] = grouped['rssi_dbm'].shift(1).fillna(df['rssi_dbm'])
    df['rssi_delta'] = df['rssi_dbm'] - df['previous_rssi']
    df['rssi_rolling_mean_5s'] = grouped['rssi_dbm'].rolling(5, min_periods=1).mean().reset_index(level=[0,1], drop=True)
    df['rssi_rolling_std_5s'] = grouped['rssi_dbm'].rolling(5, min_periods=1).std().fillna(0).reset_index(level=[0,1], drop=True)
    
    df['previous_pdr'] = grouped['pdr_percent'].shift(1).fillna(df['pdr_percent'])
    df['pdr_delta'] = df['pdr_percent'] - df['previous_pdr']
    df['pdr_rolling_mean_5s'] = grouped['pdr_percent'].rolling(5, min_periods=1).mean().reset_index(level=[0,1], drop=True)
    
    df['previous_latency'] = grouped['latency_ms'].shift(1).fillna(df['latency_ms'])
    df['latency_delta'] = df['latency_ms'] - df['previous_latency']
    df['latency_rolling_mean_5s'] = grouped['latency_ms'].rolling(5, min_periods=1).mean().reset_index(level=[0,1], drop=True)
    
    df['previous_battery'] = grouped['battery_level_percent'].shift(1).fillna(df['battery_level_percent'])
    df['battery_delta'] = df['battery_level_percent'] - df['previous_battery']
    
    df['route_changes_last_30s'] = grouped['route_change'].rolling(30, min_periods=1).sum().reset_index(level=[0,1], drop=True)
    df['is_disconnected'] = (df['node_status'] == 'DISCONNECTED').astype(int)
    df['disconnects_last_30s'] = grouped['is_disconnected'].rolling(30, min_periods=1).sum().reset_index(level=[0,1], drop=True)
    
    sector_cols = ['sector_1_rssi', 'sector_2_rssi', 'sector_3_rssi', 'sector_4_rssi']
    df['mean_sector_rssi'] = df[sector_cols].mean(axis=1)
    df['max_sector_rssi'] = df[sector_cols].max(axis=1)
    df['min_sector_rssi'] = df[sector_cols].min(axis=1)
    df['sector_rssi_variance'] = df[sector_cols].var(axis=1)
    
    df['previous_distance'] = grouped['distance_to_gateway'].shift(1).fillna(df['distance_to_gateway'])
    df['distance_delta'] = df['distance_to_gateway'] - df['previous_distance']
    
    df['previous_neighbor_count'] = grouped['neighbor_count'].shift(1).fillna(df['neighbor_count'])
    df['neighbor_count_delta'] = df['neighbor_count'] - df['previous_neighbor_count']
    
    # Time since route change
    def time_since_change(s):
        last_change = 0
        res = []
        for i, val in enumerate(s):
            if val == 1:
                last_change = i
            res.append(i - last_change)
        return pd.Series(res, index=s.index)
        
    df['time_since_route_change'] = grouped['route_change'].apply(time_since_change).reset_index(level=[0,1], drop=True)
    
    return df

df_ml = engineer_features(df_raw)
print(f"Engineered features. Shape: {df_ml.shape}")

print("--- DATA VALIDATION ---")
print(f"PDR range: {df_ml['pdr_percent'].min():.2f} to {df_ml['pdr_percent'].max():.2f} (Expected 0-100)")
print(f"Battery range: {df_ml['battery_level_percent'].min():.2f} to {df_ml['battery_level_percent'].max():.2f} (Expected 0-100)")
print(f"Packet Loss range: {df_ml['packet_loss_percent'].min():.2f} to {df_ml['packet_loss_percent'].max():.2f} (Expected 0-100)")

invalid_hops = df_ml[(df_ml['hop_count'] < -1) | (df_ml['hop_count'] > 6)]
print(f"Invalid hop counts: {len(invalid_hops)}")

battery_increases = df_ml[df_ml['battery_delta'] > 0.1]
print(f"Significant battery increases: {len(battery_increases)}")

disconnected_routing = df_ml[(df_ml['node_status'] == 'DISCONNECTED') & (df_ml['hop_count'] > 0)]
print(f"Disconnected nodes routing packets: {len(disconnected_routing)}")

active_sectors = df_ml['active_antenna_sector'].unique()
print(f"Active sectors: {active_sectors}")

print("\nClass Distribution:")
print(df_ml['link_quality_class'].value_counts(normalize=True) * 100)

plt.style.use('seaborn-v0_8-darkgrid')
fig, axes = plt.subplots(5, 2, figsize=(20, 25))
fig.tight_layout(pad=5.0)

sample_df = df_ml.sample(min(10000, len(df_ml)))

# 1. RSSI vs Distance
sns.scatterplot(data=sample_df, x='distance_to_gateway', y='rssi_dbm', alpha=0.3, ax=axes[0,0])
axes[0,0].set_title('1. RSSI vs Distance')

# 2. RSSI vs PDR
sns.scatterplot(data=sample_df, x='rssi_dbm', y='pdr_percent', alpha=0.3, ax=axes[0,1])
axes[0,1].set_title('2. RSSI vs PDR')

# 3. RSSI vs Latency
sns.scatterplot(data=sample_df[sample_df['latency_ms']>0], x='rssi_dbm', y='latency_ms', alpha=0.3, ax=axes[1,0])
axes[1,0].set_title('3. RSSI vs Latency')

# 4. Hop Count vs Latency
sns.boxplot(data=sample_df[sample_df['hop_count']>0], x='hop_count', y='latency_ms', ax=axes[1,1])
axes[1,1].set_title('4. Hop Count vs Latency')

# 5. Battery vs Mission Time
mission_sample = df_ml[df_ml['mission_id'] == 1]
sns.lineplot(data=mission_sample, x='timestamp', y='battery_level_percent', hue='node_id', ax=axes[2,0])
axes[2,0].set_title('5. Battery vs Mission Time (Mission 1)')

# 6. Link Quality distribution
sns.histplot(df_ml['actual_link_quality_score'], bins=30, kde=True, ax=axes[2,1])
axes[2,1].set_title('6. Link Quality Distribution')

# 7. Link Quality by Environment
sns.boxplot(data=sample_df, x='environment', y='actual_link_quality_score', ax=axes[3,0])
axes[3,0].set_title('7. Link Quality by Environment')

# 8. Link Quality by Frequency
sns.boxplot(data=sample_df, x='frequency_mhz', y='actual_link_quality_score', ax=axes[3,1])
axes[3,1].set_title('8. Link Quality by Frequency')

# 9. Route Changes over Time
route_changes = df_ml.groupby('timestamp')['route_change'].sum().reset_index()
sns.lineplot(data=route_changes, x='timestamp', y='route_change', ax=axes[4,0])
axes[4,0].set_title('9. Total Route Changes over Time')

# 10. Correlation Matrix
corr_cols = ['rssi_dbm', 'pdr_percent', 'latency_ms', 'packet_loss_percent', 'distance_to_gateway', 'hop_count', 'actual_link_quality_score']
sns.heatmap(sample_df[corr_cols].corr(), annot=True, cmap='coolwarm', ax=axes[4,1])
axes[4,1].set_title('10. Correlation Matrix')

plt.savefig('exploratory_plots.png')

mission_to_plot = 1
df_m1 = df_ml[df_ml['mission_id'] == mission_to_plot]

plt.figure(figsize=(10, 8))
sns.scatterplot(data=df_m1, x='simulation_x', y='simulation_y', hue='node_id', alpha=0.5)
plt.scatter([250], [250], color='red', marker='*', s=200, label='Gateway')
plt.title(f'Node Movements for Mission {mission_to_plot}')
plt.legend()
plt.savefig('mission_movements.png')

missions = df_ml['mission_id'].unique()
np.random.shuffle(missions)

train_missions = missions[:70]
val_missions = missions[70:85]
test_missions = missions[85:]

df_ml['split'] = 'train'
df_ml.loc[df_ml['mission_id'].isin(val_missions), 'split'] = 'val'
df_ml.loc[df_ml['mission_id'].isin(test_missions), 'split'] = 'test'

print("Splits:")
print(df_ml['split'].value_counts())

df_raw.to_csv('mesh_telemetry_raw.csv', index=False)
df_ml.to_csv('mesh_telemetry_ml_ready.csv', index=False)
df_missions.to_csv('missions.csv', index=False)
df_events.to_csv('events.csv', index=False)

summary = {
    'number_of_missions': int(NUM_MISSIONS),
    'number_of_rows': int(len(df_ml)),
    'number_of_nodes': len(NODES),
    'class_distribution': df_ml['link_quality_class'].value_counts(normalize=True).to_dict(),
    'frequency_distribution': df_ml['frequency_mhz'].value_counts(normalize=True).to_dict(),
    'environment_distribution': df_ml['environment'].value_counts(normalize=True).to_dict(),
    'average_rssi': float(df_ml['rssi_dbm'].mean()),
    'average_pdr': float(df_ml['pdr_percent'].mean()),
    'average_latency': float(df_ml['latency_ms'].mean()),
    'average_battery': float(df_ml['battery_level_percent'].mean()),
    'route_changes': int(df_ml['route_change'].sum()),
    'disconnect_events': int((df_ml['node_status'] == 'DISCONNECTED').sum())
}

with open('synthetic_data_summary.json', 'w') as f:
    json.dump(summary, f, indent=4)

print("DATASET GENERATED SUCCESSFULLY")
print(df_ml.head(20))
