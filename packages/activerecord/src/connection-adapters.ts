/**
 * Connection adapters — top-level module for database adapter infrastructure.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters
 */
export interface ConnectionAdapters {
  readonly AbstractAdapter: unknown;
}

export { AbstractAdapter } from "./connection-adapters/abstract-adapter.js";
export { ConnectionHandler } from "./connection-adapters/abstract/connection-handler.js";
export { ConnectionPool } from "./connection-adapters/abstract/connection-pool.js";
export { SchemaStatements } from "./connection-adapters/abstract/schema-statements.js";
export { SchemaCreation } from "./connection-adapters/abstract/schema-creation.js";
export { Column } from "./connection-adapters/column.js";
export { PoolConfig } from "./connection-adapters/pool-config.js";
export { PoolManager } from "./connection-adapters/pool-manager.js";
export { SchemaCache } from "./connection-adapters/schema-cache.js";
export { SqlTypeMetadata } from "./connection-adapters/sql-type-metadata.js";
export { StatementPool } from "./connection-adapters/statement-pool.js";
