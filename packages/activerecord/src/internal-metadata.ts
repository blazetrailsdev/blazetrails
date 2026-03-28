/**
 * Internal metadata — stores internal key-value data like environment name.
 *
 * Mirrors: ActiveRecord::InternalMetadata
 */

import type { DatabaseAdapter } from "./adapter.js";
import { detectAdapterName } from "./adapter-name.js";

export class NullInternalMetadata {
  async createTable(): Promise<void> {}
  async dropTable(): Promise<void> {}

  async get(key: string): Promise<string | null> {
    return null;
  }

  async tableExists(): Promise<boolean> {
    return false;
  }
}

export class InternalMetadata {
  static readonly TABLE_NAME = "ar_internal_metadata";
  private _adapter: DatabaseAdapter;

  private get _quotedTable(): string {
    return `"${InternalMetadata.TABLE_NAME}"`;
  }

  constructor(adapter: DatabaseAdapter) {
    this._adapter = adapter;
  }

  async createTable(): Promise<void> {
    const tsType = detectAdapterName(this._adapter) === "postgres" ? "TIMESTAMP" : "DATETIME";
    await this._adapter.executeMutation(
      `CREATE TABLE IF NOT EXISTS ${this._quotedTable} (` +
        `"key" VARCHAR(255) NOT NULL PRIMARY KEY, ` +
        `"value" VARCHAR(255), ` +
        `"created_at" ${tsType} NOT NULL, ` +
        `"updated_at" ${tsType} NOT NULL)`,
    );
  }

  async dropTable(): Promise<void> {
    await this._adapter.executeMutation(`DROP TABLE IF EXISTS ${this._quotedTable}`);
  }

  async get(key: string): Promise<string | null> {
    const rows = await this._adapter.execute(
      `SELECT "value" FROM ${this._quotedTable} WHERE "key" = ?`,
      [key],
    );
    if (rows.length === 0) return null;
    return String(rows[0].value);
  }

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString().replace("T", " ").replace("Z", "");
    const existing = await this.get(key);
    if (existing !== null) {
      await this._adapter.executeMutation(
        `UPDATE ${this._quotedTable} SET "value" = ?, "updated_at" = ? WHERE "key" = ?`,
        [value, now, key],
      );
    } else {
      await this._adapter.executeMutation(
        `INSERT INTO ${this._quotedTable} ("key", "value", "created_at", "updated_at") VALUES (?, ?, ?, ?)`,
        [key, value, now, now],
      );
    }
  }

  async tableExists(): Promise<boolean> {
    try {
      await this._adapter.execute(`SELECT 1 FROM ${this._quotedTable} LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  async deleteAll(): Promise<void> {
    await this._adapter.executeMutation(`DELETE FROM ${this._quotedTable}`);
  }
}
