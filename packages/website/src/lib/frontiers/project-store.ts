/**
 * ProjectStore — persists SQLite databases to IndexedDB.
 * Each project is a named SQLite database stored as a Uint8Array.
 */

const DB_NAME = "blazetrails-frontiers";
const DB_VERSION = 1;
const STORE_NAME = "projects";

export interface ProjectMeta {
  name: string;
  createdAt: string;
  updatedAt: string;
  size: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class ProjectStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = openDB();
  }

  async list(): Promise<ProjectMeta[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result as any[]).map((r) => ({
          name: r.name as string,
          createdAt: r.createdAt as string,
          updatedAt: r.updatedAt as string,
          size: (r.data as Uint8Array).length,
        }));
        results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async save(name: string, data: Uint8Array): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const existing = store.get(name);
      existing.onsuccess = () => {
        const record = {
          name,
          data,
          createdAt: existing.result?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const put = store.put(record);
        put.onsuccess = () => resolve();
        put.onerror = () => {
          if (put.error?.name === "QuotaExceededError") {
            reject(new Error("Storage quota exceeded. Delete some projects or export as a file."));
          } else {
            reject(put.error);
          }
        };
      };
      existing.onerror = () => reject(existing.error);
    });
  }

  async load(name: string): Promise<Uint8Array | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(name);
      req.onsuccess = () => {
        resolve(req.result ? (req.result.data as Uint8Array) : null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async delete(name: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async exists(name: string): Promise<boolean> {
    const data = await this.load(name);
    return data !== null;
  }

  /** Download a project as a .sqlite file. */
  static downloadFile(name: string, data: Uint8Array): void {
    const blob = new Blob([data], { type: "application/x-sqlite3" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Read a .sqlite file from a File input. */
  static async readFile(file: File): Promise<Uint8Array> {
    return new Uint8Array(await file.arrayBuffer());
  }
}
