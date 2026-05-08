/**
 * Default migration execution strategy — runs migrations directly.
 *
 * Mirrors: ActiveRecord::Migration::DefaultStrategy
 *
 * Simply calls the migration's up/down method. A custom strategy could
 * wrap this with advisory locks to prevent concurrent migrations.
 */

import type { DatabaseAdapter } from "../adapter.js";
import { ExecutionStrategy } from "./execution-strategy.js";
import type { MigrationLike } from "./execution-strategy.js";

export class DefaultStrategy extends ExecutionStrategy {
  private _adapter: DatabaseAdapter | null = null;

  async exec(
    direction: "up" | "down",
    migration: MigrationLike,
    adapter: DatabaseAdapter,
  ): Promise<void> {
    this.migration = migration;
    this._adapter = adapter;
    if (direction === "up") {
      await migration.up(adapter);
    } else {
      await migration.down(adapter);
    }
  }

  /** @internal */
  connection(): DatabaseAdapter {
    // Mirrors Rails: DefaultStrategy#connection → migration.connection →
    //   @connection || DatabaseTasks.migration_connection.
    // migration.connection is the per-migration override; _adapter is the
    // global migration connection passed to exec(). Per-migration wins,
    // then global exec() connection, then DatabaseTasks.migrationConnection().
    const conn =
      (this.migration as MigrationLike | null)?.connection ??
      this._adapter ??
      this._migrationConnectionFallback();
    if (!conn) throw new Error("DefaultStrategy: no adapter available");
    return conn;
  }

  private _migrationConnectionFallback(): DatabaseAdapter | null {
    // Lazy import to avoid a circular dep: database-tasks.ts → migration.ts →
    // default-strategy.ts → database-tasks.ts.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseTasks } = require("../tasks/database-tasks.js") as {
        DatabaseTasks: { migrationConnection(): DatabaseAdapter | null };
      };
      return DatabaseTasks.migrationConnection();
    } catch {
      return null;
    }
  }
}
