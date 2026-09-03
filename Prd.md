Product Requirements Document (PRD)Project: Zero-Profile Tactical MANET DashboardDesign Language: Institutional / Palantir-InspiredDeployment: Vercel (Frontend/Web), Local Browser Storage1. Product OverviewA high-survivability tactical dashboard designed for the Mission Commander. It ingests real-time RSSI telemetry from squad helmet antennas, calculates relative physical positioning using a Support Tank anchor at (0,0), and visually flags network fragmentation.2. Core Functional RequirementsOperational Modes (The Toggle)Live Mode: Ingests raw telemetry via WebSockets directly from the squad's ESP32 hardware. All simulation tools are locked out.Simulation Mode: An interactive presentation environment for SIH judges. Features a drag-and-drop 2D canvas to physically move nodes behind concrete barriers.The RF Jammer (Demo Mode ONLY): A dedicated UI slider exclusively available in Simulation Mode. Dragging the slider mathematically increases the ambient noise floor ($N$), artificially degrading the calculated SINR ($SINR = \frac{S}{I+N}$) to simulate electronic warfare or deep-basement signal loss.Ad-Hoc Network HealingTrigger: Activates when a node's SINR drops below the minimum threshold required for L-Band video streaming.Visual Vectoring (UI ONLY): The system projects a pulsing, translucent "Ghost Node" (hollow wireframe circle) onto the 2D map at the exact $(x,y)$ coordinate needed to bridge the dead zone. A dashed high-contrast line connects the dropped commando to this waypoint.Command Execution: The system provides zero automated text or audio prompts to the ground team. The Mission Commander interprets the Ghost Node visually on the UI and verbally issues the repositioning order over the tactical radio (e.g., "Alpha, shift five meters North").3. UI/UX Specifications (Palantir Aesthetic)Topology Centerpiece: The central screen real estate is entirely dedicated to the dynamic Node-Link Graph.Video Integration: The L-Band live feed is a modular, draggable Picture-in-Picture (PiP) window that never obscures the tactical map.Visual Language: Hyper-minimalist. Stark white/slate backgrounds, jet black or white heavy sans-serif headers (e.g., Inter/Roboto), and 1px flat borders with zero drop-shadows.Telemetry Tables: Granular data (RSSI, battery, active antenna sector) is displayed in dense, unstyled, monospace font tables mimicking raw intelligence feeds.Tactical Color Coding:Default/Healthy: Muted Grey.Degraded: Stark Amber.Fragmented/Ghost Node: Crimson.4. Technical ArchitectureFrontend Interface: React/Next.js hosted on Vercel.Mathematical Processing: Python/NumPy backend services to handle intensive spatial trilateration and vector math in real-time.Local Storage: 100% browser-native (IndexedDB/localStorage) for zero-latency logging of telemetry and simulation presets without external database dependencies.Redundancy (Fallback): A secondary Terminal User Interface (TUI) built in Go, proving the system remains operational in ultra-low-bandwidth or headless edge environments.WebSocket & JSON Data SchemaTo make the hybrid dashboard work, you need three distinct JSON payloads passing through your WebSocket connection.1. Inbound Telemetry Payload (Hardware $\rightarrow$ Dashboard)This is the raw data emitted by the ESP32 (or the simulated nodes) every 500ms.JSON{
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
      {
        "target_node": "TANK-00",
        "link_rssi": -72
      },
      {
        "target_node": "CMD-01",
        "link_rssi": -45
      }
    ]
  }
}
2. Outbound Topology & Healing Payload (Backend $\rightarrow$ UI)After your Python/NumPy backend crunches the telemetry and calculates the relative $(x,y)$ coordinates, it sends this processed state to the React frontend to draw the Palantir map.JSON{
  "event": "topology_state",
  "timestamp": 1725178556150,
  "payload": {
    "nodes": [
      {
        "node_id": "TANK-00",
        "type": "anchor",
        "coord_x": 0.0,
        "coord_y": 0.0,
        "status": "healthy"
      },
      {
        "node_id": "CMD-02",
        "type": "operator",
        "coord_x": 14.5,
        "coord_y": -8.2,
        "status": "critical"
      }
    ],
    "ghost_nodes": [
      {
        "target_node": "CMD-02",
        "optimal_x": 10.0,
        "optimal_y": -5.5,
        "action_required": "reposition_relay"
      }
    ]
  }
}
3. Jammer Simulation Payload (UI $\rightarrow$ Backend)When the judge slides the RF Jammer in Demo Mode, the frontend fires this payload to the backend to instantly alter the math model.JSON{
  "event": "simulation_jammer_update",
  "timestamp": 1725178558000,
  "payload": {
    "jammer_active": true,
    "artificial_noise_modifier_db": 25,
    "target_zone": "global"
  }
}

/zero-profile-dashboard
  /app                  <-- Your Next.js/React frontend (Palantir UI)
  /api
    ws.py               <-- Your Python/FastAPI WebSocket endpoint for the ESP32
    requirements.txt    <-- Includes numpy, fastapi, etc.
  vercel.json