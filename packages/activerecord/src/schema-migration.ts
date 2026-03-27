/**
 * Schema migration — tracks which migrations have been run.
 *
 * Mirrors: ActiveRecord::SchemaMigration
 */

import type { DatabaseAdapter } from "./adapter.js";

export class NullSchemaMigration {
  createTable(): void {}
  dropTable(): void {}

  get allVersions(): string[] {
    return [];
  }

  get count(): number {
    return 0;
  }

  get tableExists(): boolean {
    return false;
  }
}

export class SchemaMigration {
  static readonly TABLE_NAME = "schema_migrations";
  private _adapter: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this._adapter = adapter;
  }

  async createTable(): Promise<void> {
    await this._adapter.executeMutation(
      `CREATE TABLE IF NOT EXISTS ${SchemaMigration.TABLE_NAME} (version VARCHAR(255) NOT NULL PRIMARY KEY)`,
    );
  }

  async dropTable(): Promise<void> {
    await this._adapter.executeMutation(`DROP TABLE IF EXISTS ${SchemaMigration.TABLE_NAME}`);
  }

  async allVersions(): Promise<string[]> {
    const rows = await this._adapter.execute(
      `SELECT version FROM ${SchemaMigration.TABLE_NAME} ORDER BY version`,
    );
    return rows.map((row) => String(row.version));
  }

  async count(): Promise<number> {
    const rows = await this._adapter.execute(
      `SELECT COUNT(*) AS cnt FROM ${SchemaMigration.TABLE_NAME}`,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async tableExists(): Promise<boolean> {
    try {
      await this._adapter.execute(`SELECT 1 FROM ${SchemaMigration.TABLE_NAME} LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  async recordVersion(version: string): Promise<void> {
    await this._adapter.executeMutation(
      `INSERT OR IGNORE INTO ${SchemaMigration.TABLE_NAME} (version) VALUES (?)`,
      [version],
    );
  }

  async deleteVersion(version: string): Promise<void> {
    await this._adapter.executeMutation(
      `DELETE FROM ${SchemaMigration.TABLE_NAME} WHERE version = ?`,
      [version],
    );
  }

  async deleteAllVersions(): Promise<void> {
    await this._adapter.executeMutation(`DELETE FROM ${SchemaMigration.TABLE_NAME}`);
  }
}
