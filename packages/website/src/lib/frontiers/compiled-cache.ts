import type { SqlJsAdapter } from "./sql-js-adapter.js";

/**
 * Stores transpiled JS alongside TS source in the database.
 * The service worker reads from this table to serve .ts files as JS
 * without needing to transpile on every request.
 */
export class CompiledCache {
  constructor(private adapter: SqlJsAdapter) {
    this.adapter.runSql(`
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
      `SELECT "js" FROM "_vfs_compiled" WHERE "path" = '${esc(path)}'`,
    );
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string;
  }

  set(path: string, js: string, sourceHash: string): void {
    const existing = this.adapter.execRaw(
      `SELECT 1 FROM "_vfs_compiled" WHERE "path" = '${esc(path)}'`,
    );
    if (existing.length && existing[0].values.length) {
      this.adapter.runSql(
        `UPDATE "_vfs_compiled" SET "js" = '${esc(js)}', "source_hash" = '${esc(sourceHash)}', "updated_at" = datetime('now') WHERE "path" = '${esc(path)}'`,
      );
    } else {
      this.adapter.runSql(
        `INSERT INTO "_vfs_compiled" ("path", "js", "source_hash") VALUES ('${esc(path)}', '${esc(js)}', '${esc(sourceHash)}')`,
      );
    }
  }

  getSourceHash(path: string): string | null {
    const results = this.adapter.execRaw(
      `SELECT "source_hash" FROM "_vfs_compiled" WHERE "path" = '${esc(path)}'`,
    );
    if (!results.length || !results[0].values.length) return null;
    return results[0].values[0][0] as string;
  }

  delete(path: string): void {
    this.adapter.runSql(`DELETE FROM "_vfs_compiled" WHERE "path" = '${esc(path)}'`);
  }
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}
