import type { SqlJsAdapter } from "./sql-js-adapter.js";
import { compressSync, decompressSync } from "fflate";

/**
 * Version history — stores compressed DB snapshots in a SQLite table.
 * Each snapshot is a full database export, compressed with fflate.
 */
export class VersionHistory {
  private maxSnapshots: number;

  constructor(
    private adapter: SqlJsAdapter,
    opts?: { maxSnapshots?: number },
  ) {
    this.maxSnapshots = opts?.maxSnapshots ?? 50;
    this.adapter.execRaw(`
      CREATE TABLE IF NOT EXISTS "_vfs_history" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "label" TEXT NOT NULL DEFAULT '',
        "size" INTEGER NOT NULL,
        "data" BLOB NOT NULL,
        "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Save a snapshot. Pass the full DB export (Uint8Array).
   * The snapshot is compressed before storing.
   */
  save(dbExport: Uint8Array, label = ""): number {
    const compressed = compressSync(dbExport);
    this.adapter.execRaw(
      `INSERT INTO "_vfs_history" ("label", "size", "data") VALUES ('${label.replace(/'/g, "''")}', ${compressed.length}, x'${toHex(compressed)}')`,
    );
    // Get the id
    const result = this.adapter.execRaw("SELECT last_insert_rowid() as id");
    const id = result[0]?.values[0]?.[0] as number;

    // Prune old snapshots
    this.adapter.execRaw(
      `DELETE FROM "_vfs_history" WHERE "id" NOT IN (SELECT "id" FROM "_vfs_history" ORDER BY "id" DESC LIMIT ${this.maxSnapshots})`,
    );

    return id;
  }

  /**
   * List all snapshots (most recent first).
   */
  list(): Array<{ id: number; label: string; size: number; createdAt: string }> {
    const results = this.adapter.execRaw(
      `SELECT "id", "label", "size", "created_at" FROM "_vfs_history" ORDER BY "id" DESC`,
    );
    if (!results.length) return [];
    return results[0].values.map((row) => ({
      id: row[0] as number,
      label: row[1] as string,
      size: row[2] as number,
      createdAt: row[3] as string,
    }));
  }

  /**
   * Load a snapshot by ID. Returns the decompressed full DB export.
   */
  load(id: number): Uint8Array | null {
    const results = this.adapter.execRaw(`SELECT "data" FROM "_vfs_history" WHERE "id" = ${id}`);
    if (!results.length || !results[0].values.length) return null;
    const compressed = results[0].values[0][0] as Uint8Array;
    return decompressSync(compressed);
  }

  /**
   * Delete a specific snapshot.
   */
  delete(id: number): void {
    this.adapter.execRaw(`DELETE FROM "_vfs_history" WHERE "id" = ${id}`);
  }

  /**
   * Number of snapshots stored.
   */
  count(): number {
    const results = this.adapter.execRaw('SELECT COUNT(*) FROM "_vfs_history"');
    return (results[0]?.values[0]?.[0] as number) ?? 0;
  }
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
