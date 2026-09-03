# Background Knowledge: Zero-Profile Tactical MANET System

## 1. Project Identity
* **Hackathon:** Smart India Hackathon (SIH) 
* **Problem Statement ID:** 26185
* **Target Agency:** Ministry of Home Affairs | National Security Guard (NSG)
* **Project Title:** Zero-Profile Directional Patch Helmet Antenna & Tactical Mesh Dashboard
* **Domain:** Hardware / Robotics and Drones / Tactical Communications

## 2. The Problem Space (Urban CQB & Commando Comms)
* **Physical Snagging:** Legacy rigid whip antennas (vest-mounted) catch on doors/debris during dynamic room entries, snapping or injuring operators.
* **Structural Attenuation:** Concrete walls, steel rebar, and deep basements severely degrade RF signals, breaking the mesh network and dropping critical L-Band live video feeds.
* **Radiation Risks (SAR):** High-power RF emitted near the torso/head causes biological safety concerns (High Specific Absorption Rate).
* **Network Fragmentation:** GPS does not work indoors. When a commando loses signal, standard radios cannot actively tell the squad how to reposition to heal the network.

## 3. The Hardware Solution (Commando Node)
A modular, ultra-light helmet cover that upgrades commando communications without replacing existing armor.
* **Substrate & Materials:** Precision-cut copper tape elements housed in flexible, weather-proof, impact-resistant TPU plastic.
* **Form Factor:** Zero-profile conformal array. Fits completely flush against the helmet. 100% non-destructive (no drilling required), preserving the NIJ 0106.01 ballistic rating.
* **Dual-Band Support:** Simultaneous UHF (for ground-to-ground squad voice) and L-Band (for live video uplinks to overhead UAV relays).
* **Smart Spatial Beamforming:** An onboard ESP32 microcontroller continuously evaluates Signal-to-Interference-plus-Noise Ratio (SINR). It uses RF switches to dynamically fire the specific antenna elements (2 at a time) facing the strongest signal path, punching through concrete.
* **Operator Safety:** Utilizes Artificial Magnetic Conductor (AMC) metamaterial layers to isolate the skull, reflecting 99% of RF radiation outward (Ultra-Low SAR).

## 4. The Software Solution (Mission Commander Dashboard)
A "Palantir-inspired" tactical web dashboard to monitor and heal the squad's Mobile Ad-Hoc Network (MANET).
* **Tech Stack:** Next.js/React frontend + Python/NumPy backend (hosted natively on Vercel utilizing Vercel's ASGI WebSocket support).
* **Storage:** 100% browser-native (IndexedDB/localStorage) for zero-latency, offline-capable logging.
* **Ad-Hoc Network Healing:** 
  * Backend ingests telemetry and calculates relative operator coordinates using a stationary Support Tank as the (0,0) anchor.
  * When a commando's SINR drops below video-streaming thresholds, the system calculates a spatial vector.
  * The UI projects a visual **"Ghost Node"** on the 2D topology map, showing the Commander exactly where the nearest commando must move to re-bridge the dead zone.
* **Military Redundancy:** Includes a secondary, headless Terminal User Interface (TUI) built in Go to prove system survivability in ultra-low-bandwidth environments.

## 5. Network Routing & Physics Concepts
* **RSSI vs. SINR:** The system relies on SINR (Signal-to-Interference-plus-Noise Ratio) rather than RSSI (Received Signal Strength). RSSI is easily tricked by enemy jamming or multipath echo; SINR measures actual link clarity.
* **Proactive Topology Mapping:** The MANET uses protocols like B.A.T.M.A.N. or OLSR, pinging lightweight "Hello" packets to map the physical chain of radios (breadcrumbs).
* **Video Prioritization:** The network uses strict Quality of Service (QoS). Command telemetry > Voice > Video. If the pipe shrinks, video bitrates drop dynamically before voice is ever compromised.

## 6. SIH Pitch & Demo Mechanics
* **Interactive Demo Mode:** The dashboard features a toggle to switch from live hardware to a simulated 2D drag-and-drop canvas.
* **The "Jammer" Feature:** An interactive UI slider that artificially injects noise into the Python math model, actively degrading SINR to prove the Ghost Node healing algorithm works live in front of the judges.
* **Vercel Constraints Mitigated:** The ESP32 firmware is coded to auto-reconnect to survive Vercel's 5-minute Serverless WebSocket timeouts, ensuring uninterrupted demo performance.