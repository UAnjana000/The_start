import { TelemetryPacket } from '../types/tactical';

const DB_NAME = 'TacticalMANET_Blackbox';
const DB_VERSION = 1;
const STORE_NAME = 'telemetry_logs';

class OfflineBlackboxDB {
  private db: IDBDatabase | null = null;
  private isReady: Promise<void>;

  constructor() {
    this.isReady = this.init();
  }

  private init(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
          store.createIndex('timestamp', 'timestamp', { unique: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event);
        reject(event);
      };
    });
  }

  public async logPacket(packet: TelemetryPacket): Promise<void> {
    await this.isReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(packet);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getLogHistory(limit: number = 200): Promise<TelemetryPacket[]> {
    await this.isReady;
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor(null, 'prev');
      const results: TelemetryPacket[] = [];

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results.reverse());
        }
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async clearLogs(): Promise<void> {
    await this.isReady;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async exportLogsAsJSON(): Promise<string> {
    const logs = await this.getLogHistory(1000);
    return JSON.stringify(logs, null, 2);
  }
}

export const tacticalBlackbox = new OfflineBlackboxDB();

// ----------------------------------------------------------- Firebase RTDB ---

import { TacticalNode } from '../types/tactical';

export const firebaseConfig = {
  apiKey: "AIzaSyA3A0xUAWmPE0h8oJabXk7SC2lR6qG4QIQ",
  authDomain: "apparatus-certified.firebaseapp.com",
  databaseURL: "https://apparatus-certified-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "apparatus-certified",
  storageBucket: "apparatus-certified.firebasestorage.app",
  messagingSenderId: "371116757545",
  appId: "1:371116757545:web:a0665dc32c96b02198c238"
};

export interface FirebaseNodeData {
  rssiNode: number;
  rssiGw: number;
  antenna: number; // 1 or 2 via AS179-92LF
  hops: number;
  seq: number;
}

export interface FirebaseNodeRecord {
  lat: number;
  lon: number;
  ts: number;
  data: FirebaseNodeData;
}

export interface FirebaseNodesPayload {
  [key: string]: FirebaseNodeRecord;
}

// Role and Callsign mapper for ESP32 mesh nodes
export const NODE_METADATA: Record<number, { callsign: string; role: TacticalNode['role'] }> = {
  1: { callsign: 'ALPHA-POINT', role: 'pointman' },
  2: { callsign: 'BRAVO-ASSAULT', role: 'assault' },
  3: { callsign: 'CHARLIE-RELAY', role: 'breacher' },
  4: { callsign: 'DELTA-MARKS', role: 'marksman' },
  5: { callsign: 'ECHO-SCOUT', role: 'scout_relay' },
};

// Gateway Reference Datum (TOC Base Origin)
export const GATEWAY_DATUM = {
  lat: 12.907200,
  lon: 77.566300,
};

// Convert GPS Lat/Lon to Local Cartesian Metric Coordinates (X, Y in meters)
export function gpsToLocalGrid(lat: number, lon: number, origin = GATEWAY_DATUM): { x: number; y: number } {
  if (Math.abs(lat) < 50 && Math.abs(lon) < 50) {
    return { x: parseFloat(lon.toFixed(1)), y: parseFloat(lat.toFixed(1)) };
  }
  const dLat = lat - origin.lat;
  const dLon = lon - origin.lon;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);

  const y = parseFloat((dLat * metersPerDegLat).toFixed(1));
  const x = parseFloat((dLon * metersPerDegLon).toFixed(1));
  return { x, y };
}

// Transform Firebase RTDB payload into TacticalNode array
export function parseFirebaseNodes(payload: FirebaseNodesPayload, existingNodes: TacticalNode[] = []): TacticalNode[] {
  if (!payload || typeof payload !== 'object') return [];

  const now = Date.now();
  const parsedNodes: TacticalNode[] = [];

  Object.entries(payload).forEach(([key, record]) => {
    if (!record || !record.data) return;

    const idNum = parseInt(key.replace(/[^0-9]/g, ''), 10) || 1;
    const nodeId = `CMD-${idNum.toString().padStart(2, '0')}`;
    const meta = NODE_METADATA[idNum] || { callsign: `OPERATOR-${idNum}`, role: 'assault' as const };

    const { x, y } = gpsToLocalGrid(record.lat, record.lon);
    const timeDeltaMs = now - (record.ts || now);
    const isStale = timeDeltaMs > 15000 || record.data.rssiNode <= -125;

    const existing = existingNodes.find((n) => n.id === nodeId);
    const isOffline = isStale;

    const rawRssi = record.data.rssiNode || record.data.rssiGw || -80;
    const sinrDb = parseFloat(Math.max(0, Math.min(40, rawRssi - (-95))).toFixed(1));
    const battery = existing?.battery ?? Math.max(30, 100 - Math.floor((record.data.seq || 0) * 0.05));

    parsedNodes.push({
      id: nodeId,
      callsign: existing?.displayName || meta.callsign,
      displayName: existing?.displayName || meta.callsign,
      role: meta.role,
      x: isOffline ? (existing?.lastOnlineX ?? x) : x,
      y: isOffline ? (existing?.lastOnlineY ?? y) : y,
      battery,
      activeSector: record.data.antenna === 2 ? 4 : 3, // AS179-92LF Pin 4/5 antenna
      txPowerDbm: 20.0,
      noiseFloorDbm: -95.0,
      isOffline,
      lastOnlineX: isOffline ? (existing?.lastOnlineX ?? x) : x,
      lastOnlineY: isOffline ? (existing?.lastOnlineY ?? y) : y,
      lastOnlineTimestamp: record.ts,
      hopCount: record.data.hops ?? (isOffline ? 99 : 1),
      nextHopId: isOffline ? 'DISCONNECTED' : record.data.hops === 0 ? 'TANK-00' : 'CMD-01',
      bottleneckSinrDb: isOffline ? 0.0 : sinrDb,
      routePath: [nodeId, record.data.hops === 0 ? 'TANK-00' : 'RELAY'],
      isHidden: existing?.isHidden ?? false,
    });
  });

  return parsedNodes;
}

// Real-time listener for Firebase Realtime Database (/nodes.json)
export function subscribeToFirebaseNodes(
  onUpdate: (nodes: FirebaseNodesPayload, rawCount: number) => void,
  onError?: (err: any) => void
): () => void {
  const url = `${firebaseConfig.databaseURL}/nodes.json`;
  let active = true;

  const fetchData = async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: FirebaseNodesPayload = await response.json();
      if (active && data) {
        const count = Object.keys(data).length;
        onUpdate(data, count);
      }
    } catch (e) {
      if (onError) onError(e);
    }
  };

  fetchData();
  const interval = setInterval(fetchData, 3000);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

