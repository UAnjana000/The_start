# Zero-Profile Tactical MANET Dashboard — System Design Document
**Project:** SIH Problem Statement 26185 (Ministry of Home Affairs / NSG)  
**System:** Zero-Profile Directional Patch Helmet Antenna & Tactical Mesh Command & Control (C2) Dashboard  
**Design Aesthetic:** Institutional / Palantir Foundry & Gotham C2  

---

## 1. System Overview & Aesthetic Architecture

The **Zero-Profile Tactical MANET Dashboard** is an institutional-grade, high-survivability Command & Control interface designed for tactical mission commanders operating in GPS-denied, dense urban CQB (Close Quarters Battle) environments.

### Visual Language (Palantir Foundry / Gotham Inspired)
- **Palette:** Deep tactical slate (`#0b0f17`, `#111827`), high-contrast zinc borders (`#27272a`), stark monochrome text with high-visibility tactical accents:
  - **Healthy / Optimal:** Muted Tactical Grey / Cyan Accent (`#94a3b8` / `#38bdf8`)
  - **Degraded Link:** Stark Amber (`#f59e0b`)
  - **Critical / Fragmented / Ghost Relay:** High-Visibility Crimson (`#ef4444`)
- **Typography:** Crisp sans-serif headers (`Inter` / `Geist`) paired with dense, unstyled tabular monospace data streams (`JetBrains Mono` / `Roboto Mono`) replicating raw SIGINT/ELINT feeds.
- **Layout & Structure:** Grid-aligned, 1px border cards, zero gratuitous bevels or blur shadows, high data density, real-time reactive displays.

---

## 2. Core Functional Modules

### A. Dynamic 2D Topology & Tactical Graph (Centerpiece)
- **Coordinate Reference:** Anchor at `TANK-00` $(0, 0)$. All commando coordinates $(x, y)$ mapped in real-time in meters.
- **Interactive Simulation Mode:**
  - Drag-and-drop commando nodes (`CMD-01` Pointman, `CMD-02` Assault, `CMD-03` Breacher, `CMD-04` Marksman).
  - Placeable and resizable concrete barrier walls (attenuation factor: $-18\text{ dB}$ to $-35\text{ dB}$ per obstacle).
  - Node-link mesh paths with line thickness and color dynamically bound to calculated link SINR.
- **Live Hardware Mode:**
  - Ingests telemetry via WebSockets directly from ESP32 conformal helmet patch arrays.
  - Interactive manipulation locked out; displays live hardware beam sector switches and telemetry.

### B. RF Physics & Mathematical Model
- **SINR Computation:**
  $$\text{SINR} = \frac{S}{I + N}$$
  where:
  - $S$ (Signal Power): Derived from Tx power, antenna gain, Friis free-space path loss, and barrier wall attenuation.
  - $I$ (Interference): Multi-node co-channel interference and multipath scattering.
  - $N$ (Noise Floor): Base thermal noise ($-95\text{ dBm}$) $+$ artificial Jammer noise injection.
- **Conformal Sector Beamforming:**
  - 4-quadrant patch antenna array evaluated per node. The system selects the 2 active elements that maximize link budget.
- **RF Electronic Warfare (EW) Jammer Slider (Simulation/Demo Only):**
  - Allows judges to dial noise floor modifier ($0\text{ dB}$ to $+40\text{ dB}$) globally or over specific tactical sectors, instantly degrading commando SINR to trigger network healing.

### C. Ad-Hoc Network Healing & "Ghost Node" Vectoring
- **Trigger:** Evaluated when any operator's link SINR drops below the minimum L-Band video streaming threshold ($< 12\text{ dB}$).
- **Vectoring Math:** Calculates the minimum Euclidean offset along the line-of-sight path or waypoint intersection that restores $> 18\text{ dB}$ SINR to the nearest relay/anchor.
- **UI Projection:** 
  - Pulsing wireframe circle (**Ghost Node**) rendered at calculated optimal $(x, y)$.
  - Dashed high-contrast vector line with distance offset (e.g. `"SHIFT 4.8m NW"`).
  - Zero automated voice/audio interference—commander verbally conveys tactical repositioning over secure radio.

### D. Draggable Picture-in-Picture (PiP) Tactical Video Feed
- Modular, draggable, floating HUD window displaying simulated/real-time L-Band helmet cam feeds.
- Dynamic bitrate & resolution adaptation matching link SINR (High Def $\rightarrow$ Low Bitrate $\rightarrow$ Static Glitch $\rightarrow$ Signal Lost).

### E. Telemetry & Intelligence Stream Table
- Dense, monospace telemetry grid logging: Node ID, Call Sign, Role, RSSI (dBm), SINR (dB), Active Antenna Sector (1–4), Battery %, QoS Video Bitrate, Mesh Hops.
- Integrated **100% browser-native IndexedDB engine** for offline mission blackbox recording and telemetry playback.

---

## 3. System Architecture & File Structure

```
/
├── app/                              # Next.js 14+ App Router (Palantir C2 Interface)
│   ├── layout.tsx                    # Dark tactical theme container
│   ├── page.tsx                      # Master Tactical C2 Dashboard
│   ├── globals.css                   # Tactical grid & typography styling
│   └── components/
│       ├── TacticalCanvas.tsx        # 2D Canvas / WebGL Node-Link Topology Graph
│       ├── GhostNodeOverlay.tsx      # Vector calculation & pulsing ghost overlay
│       ├── TelemetryTable.tsx        # High-density monospace intelligence feed
│       ├── SectorBeamforming.tsx     # 4-sector patch antenna radiation visualizer
│       ├── JammerControl.tsx         # EW Noise injection slider for SIH demo
│       ├── VideoPiP.tsx              # Draggable L-Band tactical video feed
│       ├── OfflineStorage.ts         # IndexedDB mission telemetry blackbox
│       └── MathEngine.ts             # Client-side fallback NumPy-parity RF math
├── api/
│   ├── ws.py                         # FastAPI WebSocket endpoint & NumPy trilateration engine
│   └── requirements.txt              # FastAPI, uvicorn, numpy, websockets
├── tui/                              # Secondary Headless Terminal UI (Go redundancy)
│   ├── main.go                       # Ultra-low-bandwidth ANSI / TUI C2 monitor
│   └── go.mod
├── public/                           # Tactical icons, sound effects, presets
├── vercel.json                       # Vercel deployment configuration
└── package.json
```

---

## 4. WebSocket Communication Protocol

### 1. Inbound Telemetry (`node_telemetry_update`)
```json
{
  "event": "node_telemetry_update",
  "timestamp": 1725178556000,
  "payload": {
    "node_id": "CMD-02",
    "role": "assault",
    "metrics": {
      "rssi_dbm": -68,
      "noise_floor_dbm": -95,
      "battery_pct": 84,
      "active_sector": 2
    },
    "links": [
      { "target_node": "TANK-00", "link_rssi": -72 },
      { "target_node": "CMD-01", "link_rssi": -45 }
    ]
  }
}
```

### 2. Outbound Topology & Healing State (`topology_state`)
```json
{
  "event": "topology_state",
  "timestamp": 1725178556150,
  "payload": {
    "nodes": [
      { "node_id": "TANK-00", "type": "anchor", "coord_x": 0.0, "coord_y": 0.0, "status": "healthy" },
      { "node_id": "CMD-02", "type": "operator", "coord_x": 14.5, "coord_y": -8.2, "status": "critical" }
    ],
    "ghost_nodes": [
      { "target_node": "CMD-02", "optimal_x": 10.0, "optimal_y": -5.5, "action_required": "reposition_relay" }
    ]
  }
}
```

### 3. Jammer Simulation Payload (`simulation_jammer_update`)
```json
{
  "event": "simulation_jammer_update",
  "timestamp": 1725178558000,
  "payload": {
    "jammer_active": true,
    "artificial_noise_modifier_db": 25,
    "target_zone": "global"
  }
}
```

---

## 5. Verification & Testing Criteria
1. **Interactive Simulation:** Node dragging, obstacle placement, barrier attenuation calculations update live topology at 60 FPS.
2. **Jammer & Healing Validation:** Dragging RF Jammer slider triggers immediate SINR drop, degrading video PiP and rendering the pulsing Ghost Node with vector coordinates.
3. **Dual Mode Reliability:** Seamless switching between Live Hardware WebSocket stream and SIH Demo Simulation.
4. **Offline Resilience:** Telemetry recorded directly to browser IndexedDB with export/replay functionality.
5. **Headless Redundancy:** Go TUI client connects and parses identical telemetry streams in terminal.
