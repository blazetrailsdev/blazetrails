/**
 * Pending migration connection — provides adapter access for checking
 * pending migrations without requiring a full Migrator.
 *
 * Mirrors: ActiveRecord::PendingMigrationConnection
 *
 * In Rails, this establishes a dedicated connection from the connection
 * handler for pending migration checks. Here it wraps an adapter and
 * connection name, providing a consistent interface for CheckPending
 * to obtain a database connection.
 */

import type { DatabaseAdapter } from "../adapter.js";
import type { ConnectionHandler } from "../connection-adapters/abstract/connection-handler.js";

export class PendingMigrationConnection {
  private _connectionName: string;
  private _adapter?: DatabaseAdapter;
  private _connectionHandler?: ConnectionHandler;
  private _checkedOut = false;

  constructor(
    options: {
      connectionName?: string;
      adapter?: DatabaseAdapter;
      connectionHandler?: ConnectionHandler;
    } = {},
  ) {
    this._connectionName = options.connectionName ?? "primary";
    this._adapter = options.adapter;
    this._connectionHandler = options.connectionHandler;
  }

  get connectionName(): string {
    return this._connectionName;
  }

  async withAdapter<T>(callback: (adapter: DatabaseAdapter) => Promise<T> | T): Promise<T> {
    const adapter = this._checkoutAdapter();
    if (!adapter) {
      throw new Error("No database adapter available for pending migrations");
    }
    try {
      return await callback(adapter);
    } finally {
      this._releaseIfCheckedOut();
    }
  }

  private _checkoutAdapter(): DatabaseAdapter | undefined {
    if (this._adapter) return this._adapter;
    if (this._connectionHandler) {
      const pool = this._connectionHandler.retrieveConnectionPool(this._connectionName);
      if (pool) {
        this._adapter = pool.checkout();
        this._checkedOut = true;
        return this._adapter;
      }
    }
    return undefined;
  }

  private _releaseIfCheckedOut(): void {
    if (this._checkedOut && this._adapter && this._connectionHandler) {
      const pool = this._connectionHandler.retrieveConnectionPool(this._connectionName);
      if (pool) {
        pool.checkin(this._adapter);
      }
      this._adapter = undefined;
      this._checkedOut = false;
    }
  }
}
