import type { SqlJsAdapter } from "./sql-js-adapter.js";

/**
 * Stores transpiled JS alongside TS source in the database.
 * The service worker reads from this table to serve .ts files as JS
 * without needing to transpile itself.
 */
export class CompiledCache {
  constructor(private adapter: SqlJsAdapter) {
    this.adapter.execRaw(`
      CREATE TABLE IF NOT EXISTS "_vfs_compiled" (
        "path" TEXT PRIMARY KEY NOT NULL,
        "js" TEXT NOT NULL,
        "source_hash" TEXT NOT NULL,
        "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  get(path: string): string | null {
    const results = this.adapter.execRaw(
      `SELECT "js" FROM "_vfs_compiled" WHERE "path" = '${path.replace(/'/g, "''")}'`,
    );
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string;
  }

  set(path: string, js: string, sourceHash: string): void {
    const escaped = (s: string) => s.replace(/'/g, "''");
    const existing = this.adapter.execRaw(
      `SELECT 1 FROM "_vfs_compiled" WHERE "path" = '${escaped(path)}'`,
    );
    if (existing.length && existing[0].values.length) {
      this.adapter.execRaw(
        `UPDATE "_vfs_compiled" SET "js" = '${escaped(js)}', "source_hash" = '${escaped(sourceHash)}', "updated_at" = datetime('now') WHERE "path" = '${escaped(path)}'`,
      );
    } else {
      this.adapter.execRaw(
        `INSERT INTO "_vfs_compiled" ("path", "js", "source_hash") VALUES ('${escaped(path)}', '${escaped(js)}', '${escaped(sourceHash)}')`,
      );
    }
  }

  getSourceHash(path: string): string | null {
    const results = this.adapter.execRaw(
      `SELECT "source_hash" FROM "_vfs_compiled" WHERE "path" = '${path.replace(/'/g, "''")}'`,
    );
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string;
  }

  delete(path: string): void {
    this.adapter.execRaw(
      `DELETE FROM "_vfs_compiled" WHERE "path" = '${path.replace(/'/g, "''")}'`,
    );
  }
}
