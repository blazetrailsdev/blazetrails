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
import { ConnectionHandler } from "../connection-adapters/abstract/connection-handler.js";

export class PendingMigrationConnection {
  private _connectionName: string;
  private _adapter?: DatabaseAdapter;
  private _connectionHandler?: ConnectionHandler;

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

  get adapter(): DatabaseAdapter | undefined {
    if (this._adapter) return this._adapter;
    if (this._connectionHandler) {
      const pool = this._connectionHandler.retrieveConnectionPool(this._connectionName);
      if (pool) {
        return pool.checkout();
      }
    }
    return undefined;
  }
}
