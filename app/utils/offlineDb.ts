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
