/**
 * Database statements — query execution interface.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements
 */

import { sql as arelSql, type Nodes } from "@blazetrails/arel";
import { TransactionIsolationError } from "../../errors.js";
import { quoteTableName } from "./quoting.js";

/**
 * Host interface for DatabaseStatements mixin methods that need adapter context.
 */
export interface DatabaseStatementsHost {
  preparedStatements?: boolean;
  internalExecute?(sql: string, name?: string, binds?: unknown[]): Promise<unknown>;
  rawExecute?(sql: string, name?: string, binds?: unknown[]): Promise<unknown>;
  castResult?(rawResult: unknown): { rows: unknown[][] };
  affectedRows?(rawResult: unknown): number;
  isWriteQuery?(sql: string): boolean;
  currentTransaction?(): { open: boolean; written?: boolean; joinable?(): boolean };
  disableReferentialIntegrity?(fn: () => Promise<void>): Promise<void>;
  executeBatch?(statements: string[], name?: string): Promise<void>;
  pool?: { schemaMigration?: { tableName: string }; internalMetadata?: { tableName: string } };
}

// --- Query conversion ---

/**
 * Converts an arel AST to SQL.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#to_sql
 */
export function toSql(arel: unknown, binds: unknown[] = []): string {
  const [sql] = toSqlAndBinds(arel, binds);
  return sql;
}

/**
 * Converts an arel AST to SQL and binds.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#to_sql_and_binds
 */
export function toSqlAndBinds(
  arel: unknown,
  binds: unknown[] = [],
  preparable: boolean | null = null,
  allowRetry = false,
): [string, unknown[], boolean | null, boolean] {
  if (typeof arel === "string") {
    return [arel, binds, preparable, allowRetry];
  }
  // Arel::TreeManager -> ast
  if (arel && typeof (arel as any).ast === "object") {
    arel = (arel as any).ast;
  }
  if (arel && typeof (arel as any).toSql === "function") {
    return [(arel as any).toSql(), binds, preparable, allowRetry];
  }
  throw new TypeError("Cannot convert to SQL");
}

/**
 * Returns a cacheable query object for use with StatementCache.
 * Uses prepared statements when enabled, otherwise partial queries.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#cacheable_query
 */
export function cacheableQuery(
  this: DatabaseStatementsHost | void,
  klass: { query?(sql: string): unknown; partialQuery?(parts: unknown): unknown },
  arel: unknown,
): [unknown, unknown[]] {
  // Compile the arel to SQL
  const [sql, binds] = toSqlAndBinds(arel);
  const queryObj = klass.query ? klass.query(sql) : sql;
  return [queryObj, binds as unknown[]];
}

// --- Query execution ---

/**
 * Returns rows as record hashes.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#select_all
 */
export function selectAll(
  sql: string,
  _name?: string | null,
  _binds?: unknown[],
): Promise<Record<string, unknown>[]> {
  throw new Error("selectAll must be implemented by adapter subclass");
}

/**
 * Returns a single record hash.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#select_one
 */
export function selectOne(
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<Record<string, unknown> | undefined> {
  return selectAll(sql, name, binds).then((rows) => rows[0]);
}

/**
 * Returns a single value from the first row/column.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#select_value
 */
export function selectValue(
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown> {
  return selectRows(sql, name, binds).then((rows) => singleValueFromRows(rows));
}

/**
 * Returns an array of the first column values.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#select_values
 */
export function selectValues(
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown[]> {
  return selectRows(sql, name, binds).then((rows) => rows.map((row) => row[0]));
}

/**
 * Returns an array of arrays (rows of column values).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#select_rows
 */
export function selectRows(
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown[][]> {
  return selectAll(sql, name, binds).then((rows) => rows.map((row) => Object.values(row)));
}

/**
 * Returns a single value via internal_exec_query.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#query_value
 */
export function queryValue(
  this: DatabaseStatementsHost,
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown> {
  return query.call(this, sql, name, binds).then((rows) => singleValueFromRows(rows));
}

/**
 * Returns first column of each row via internal_exec_query.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#query_values
 */
export function queryValues(
  this: DatabaseStatementsHost,
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown[]> {
  return query.call(this, sql, name, binds).then((rows) => rows.map((row) => row[0]));
}

/**
 * Executes a query and returns raw rows (arrays).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#query
 */
export async function query(
  this: DatabaseStatementsHost,
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown[][]> {
  const result = await internalExecQuery.call(this, sql, name ?? "SQL", binds);
  return (result as any).rows ?? [];
}

/**
 * Determines whether the SQL statement is a write query.
 * Must be overridden by adapter subclasses.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#write_query?
 */
export function isWriteQuery(_sql: string): boolean {
  throw new Error("isWriteQuery must be implemented by adapter subclass");
}

/**
 * Executes a SQL statement and returns the raw result.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#execute
 */
export function execute(_sql: string, _name?: string | null): Promise<unknown> {
  throw new Error("execute must be implemented by adapter subclass");
}

/**
 * Executes a query with binds and returns an ActiveRecord::Result.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#exec_query
 */
export function execQuery(
  this: DatabaseStatementsHost | void,
  sql: string,
  name: string = "SQL",
  binds: unknown[] = [],
): Promise<unknown> {
  return internalExecQuery.call(this as DatabaseStatementsHost, sql, name, binds);
}

/**
 * Executes an INSERT statement.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#exec_insert
 */
export function execInsert(
  this: DatabaseStatementsHost | void,
  sql: string,
  name?: string | null,
  binds: unknown[] = [],
): Promise<unknown> {
  return internalExecQuery.call(this as DatabaseStatementsHost, sql, name ?? "SQL", binds);
}

/**
 * Executes a DELETE statement and returns the number of affected rows.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#exec_delete
 */
export async function execDelete(
  this: DatabaseStatementsHost | void,
  sql: string,
  name?: string | null,
  binds: unknown[] = [],
): Promise<number> {
  const host = this as DatabaseStatementsHost;
  if (host?.internalExecute) {
    const result = await host.internalExecute(sql, name ?? "SQL", binds);
    return host.affectedRows ? host.affectedRows(result) : (result as number);
  }
  return execute(sql, name) as Promise<number>;
}

/**
 * Executes an UPDATE statement and returns the number of affected rows.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#exec_update
 */
export async function execUpdate(
  this: DatabaseStatementsHost | void,
  sql: string,
  name?: string | null,
  binds: unknown[] = [],
): Promise<number> {
  const host = this as DatabaseStatementsHost;
  if (host?.internalExecute) {
    const result = await host.internalExecute(sql, name ?? "SQL", binds);
    return host.affectedRows ? host.affectedRows(result) : (result as number);
  }
  return execute(sql, name) as Promise<number>;
}

/**
 * Executes a bulk INSERT statement.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#exec_insert_all
 */
export function execInsertAll(
  this: DatabaseStatementsHost | void,
  sql: string,
  name: string = "SQL",
): Promise<unknown> {
  return internalExecQuery.call(this as DatabaseStatementsHost, sql, name);
}

/**
 * Returns an EXPLAIN plan for the query. Must be overridden by adapters.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#explain
 */
export function explain(_arel: unknown, _binds?: unknown[], _options?: unknown[]): Promise<string> {
  throw new Error("explain must be implemented by adapter subclass");
}

// --- Data modification ---

/**
 * Executes an INSERT and returns the new record's ID.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#insert
 */
export async function insert(
  this: DatabaseStatementsHost | void,
  arel: unknown,
  name?: string | null,
  _pk?: string | null,
  idValue?: unknown,
  _sequenceName?: string | null,
  binds: unknown[] = [],
): Promise<unknown> {
  const [sql, resolvedBinds] = toSqlAndBinds(arel, binds);
  const value = await execInsert.call(this, sql, name, resolvedBinds);
  return idValue ?? value;
}

/**
 * Executes an UPDATE and returns the number of affected rows.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#update
 */
export async function update(
  this: DatabaseStatementsHost | void,
  arel: unknown,
  name?: string | null,
  binds: unknown[] = [],
): Promise<number> {
  const [sql, resolvedBinds] = toSqlAndBinds(arel, binds);
  return execUpdate.call(this, sql, name, resolvedBinds);
}

/**
 * Executes a DELETE and returns the number of affected rows.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#delete
 */
export async function deleteStatement(
  this: DatabaseStatementsHost | void,
  arel: unknown,
  name?: string | null,
  binds: unknown[] = [],
): Promise<number> {
  const [sql, resolvedBinds] = toSqlAndBinds(arel, binds);
  return execDelete.call(this, sql, name, resolvedBinds);
}
// Rails name: delete — aliased to avoid JS reserved word conflict.
// Consumers can import as: import { delete as delete_ } from "..."

export { deleteStatement as delete };

/**
 * Executes a TRUNCATE statement.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#truncate
 */
export async function truncate(
  this: DatabaseStatementsHost | void,
  tableName: string,
  name?: string | null,
): Promise<unknown> {
  const sql = `TRUNCATE TABLE ${quoteTableName(tableName)}`;
  return execute(sql, name);
}

/**
 * Truncates multiple tables, skipping schema_migrations and ar_internal_metadata.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#truncate_tables
 */
export async function truncateTables(
  this: DatabaseStatementsHost,
  ...tableNames: string[]
): Promise<void> {
  const schemaMigrationTable = this.pool?.schemaMigration?.tableName ?? "schema_migrations";
  const internalMetadataTable = this.pool?.internalMetadata?.tableName ?? "ar_internal_metadata";
  const filtered = tableNames.filter(
    (t) => t !== schemaMigrationTable && t !== internalMetadataTable,
  );

  if (filtered.length === 0) return;

  const statements = filtered.map((t) => `TRUNCATE TABLE ${quoteTableName(t)}`);

  const doTruncate = async () => {
    if (this.executeBatch) {
      await this.executeBatch(statements, "Truncate Tables");
    } else {
      for (const stmt of statements) {
        await execute(stmt, "Truncate Tables");
      }
    }
  };

  if (this.disableReferentialIntegrity) {
    await this.disableReferentialIntegrity(doTruncate);
  } else {
    await doTruncate();
  }
}

// --- Transaction ---

/**
 * Runs the given block in a database transaction.
 * Supports nested transactions via savepoints, isolation levels,
 * and the requires_new option.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#transaction
 */
export async function transaction<T>(
  this: DatabaseStatementsHost,
  fn: (tx?: unknown) => Promise<T> | T,
  options: { requiresNew?: boolean; isolation?: string; joinable?: boolean } = {},
): Promise<T | undefined> {
  const { requiresNew, isolation, joinable = true } = options;
  const host = this as any;

  if (!requiresNew && host.currentTransaction?.()?.joinable?.()) {
    if (isolation) {
      throw new TransactionIsolationError("cannot set isolation when joining a transaction");
    }
    const userTx = host.currentTransaction().userTransaction;
    try {
      return await fn(userTx);
    } catch (e: any) {
      if (e?.name === "Rollback") return undefined;
      throw e;
    }
  }

  if (host.withinNewTransaction) {
    try {
      return await host.withinNewTransaction({ isolation, joinable }, fn);
    } catch (e: any) {
      if (e?.name === "Rollback") return undefined;
      throw e;
    }
  }

  // Fallback: simple begin/commit/rollback
  await beginDbTransaction.call(this);
  try {
    const result = await fn();
    await commitDbTransaction.call(this);
    return result;
  } catch (e: any) {
    await rollbackDbTransaction.call(this);
    if (e?.name === "Rollback") return undefined;
    throw e;
  }
}

// --- Transaction lifecycle ---

/**
 * The transaction manager for this connection.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#transaction_manager
 */
export function transactionManager(this: DatabaseStatementsHost): unknown {
  return (this as any)._transactionManager ?? null;
}

/**
 * Marks the current transaction as written if the SQL is a write query.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#mark_transaction_written_if_write
 */
export function markTransactionWrittenIfWrite(this: DatabaseStatementsHost, sql: string): void {
  const txn = this.currentTransaction?.();
  if (txn?.open) {
    if (this.isWriteQuery?.(sql)) {
      txn.written = true;
    }
  }
}

/**
 * Whether a transaction is currently open.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#transaction_open?
 */
export function isTransactionOpen(this: DatabaseStatementsHost): boolean {
  const txn = this.currentTransaction?.();
  return txn?.open ?? false;
}

/**
 * Register a record with the current transaction for after_commit/after_rollback.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#add_transaction_record
 */
export function addTransactionRecord(
  this: DatabaseStatementsHost,
  record: unknown,
  _ensureFinalize = true,
): void {
  const txn = this.currentTransaction?.() as any;
  if (txn?.addRecord) {
    txn.addRecord(record, _ensureFinalize);
  }
}

/**
 * Begins the database transaction. No-op in abstract base; adapters override.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#begin_db_transaction
 */
export async function beginDbTransaction(): Promise<void> {
  // No-op in abstract base
}

/**
 * Begins a deferred transaction, optionally with an isolation level.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#begin_deferred_transaction
 */
export async function beginDeferredTransaction(
  this: DatabaseStatementsHost | void,
  isolationLevel?: string,
): Promise<void> {
  if (isolationLevel) {
    return beginIsolatedDbTransaction.call(this, isolationLevel);
  }
  return beginDbTransaction.call(this);
}

/**
 * Returns a map of transaction isolation level names to SQL strings.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#transaction_isolation_levels
 */
export function transactionIsolationLevels(): Record<string, string> {
  return {
    read_uncommitted: "READ UNCOMMITTED",
    read_committed: "READ COMMITTED",
    repeatable_read: "REPEATABLE READ",
    serializable: "SERIALIZABLE",
  };
}

/**
 * Begins a transaction with the given isolation level. Raises by default.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#begin_isolated_db_transaction
 */
export async function beginIsolatedDbTransaction(
  this: DatabaseStatementsHost | void,
  _isolation: string,
): Promise<void> {
  throw new TransactionIsolationError("adapter does not support setting transaction isolation");
}

/**
 * Hook called after an isolated transaction commits/rolls back.
 * No-op in most adapters; SQLite overrides to reset connection-level isolation.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#reset_isolation_level
 */
export function resetIsolationLevel(): void {
  // No-op in abstract base
}

/**
 * Commits the database transaction. No-op in abstract base.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#commit_db_transaction
 */
export async function commitDbTransaction(): Promise<void> {
  // No-op in abstract base
}

/**
 * Rolls back the database transaction.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#rollback_db_transaction
 */
export async function rollbackDbTransaction(this: DatabaseStatementsHost | void): Promise<void> {
  await execRollbackDbTransaction.call(this);
}

/**
 * Executes the ROLLBACK SQL. No-op in abstract base.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#exec_rollback_db_transaction
 */
export async function execRollbackDbTransaction(): Promise<void> {
  // No-op in abstract base
}

/**
 * Restarts the database transaction (ROLLBACK + BEGIN).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#restart_db_transaction
 */
export async function restartDbTransaction(this: DatabaseStatementsHost | void): Promise<void> {
  await execRestartDbTransaction.call(this);
}

/**
 * Executes the transaction restart SQL. No-op in abstract base.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#exec_restart_db_transaction
 */
export async function execRestartDbTransaction(): Promise<void> {
  // No-op in abstract base
}

/**
 * Rolls back to a savepoint.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#rollback_to_savepoint
 */
export async function rollbackToSavepoint(
  this: DatabaseStatementsHost | void,
  name?: string,
): Promise<void> {
  const host = this as any;
  if (host?.execRollbackToSavepoint) {
    await host.execRollbackToSavepoint(name);
  }
}

// --- Utility methods ---

/**
 * Returns the default sequence name for a table/column pair.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#default_sequence_name
 */
export function defaultSequenceName(_table: string, _column: string): string | null {
  return null;
}

/**
 * Resets the sequence to the max value for the column. No-op by default.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#reset_sequence!
 */
export async function resetSequenceBang(
  _table: string,
  _column: string,
  _sequence?: string | null,
): Promise<void> {
  // No-op by default. Implement for PostgreSQL, Oracle, etc.
}

/**
 * Inserts a single fixture row into a table.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#insert_fixture
 */
export async function insertFixture(
  this: DatabaseStatementsHost | void,
  fixture: Record<string, unknown>,
  tableName: string,
): Promise<unknown> {
  const columns = Object.keys(fixture);
  const values = Object.values(fixture).map((v) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number" || typeof v === "bigint") return String(v);
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return `'${String(v).replace(/'/g, "''")}'`;
  });

  const sql =
    columns.length > 0
      ? `INSERT INTO ${quoteTableName(tableName)} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")})`
      : `INSERT INTO ${quoteTableName(tableName)} DEFAULT VALUES`;

  return execute(sql, "Fixture Insert");
}

/**
 * Inserts a set of fixtures into tables, wrapped in a transaction.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#insert_fixtures_set
 */
export async function insertFixturesSet(
  this: DatabaseStatementsHost,
  fixtureSet: Record<string, Record<string, unknown>[]>,
  tablesToDelete: string[] = [],
): Promise<void> {
  const deleteStatements = tablesToDelete.map((t) => `DELETE FROM ${quoteTableName(t)}`);

  const insertStatements: string[] = [];
  for (const [tableName, fixtures] of Object.entries(fixtureSet)) {
    if (fixtures.length === 0) continue;
    for (const fixture of fixtures) {
      const columns = Object.keys(fixture);
      const values = Object.values(fixture).map((v) => {
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number" || typeof v === "bigint") return String(v);
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      insertStatements.push(
        `INSERT INTO ${quoteTableName(tableName)} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")})`,
      );
    }
  }

  const allStatements = [...deleteStatements, ...insertStatements];

  const doInserts = async () => {
    if (this.executeBatch) {
      await this.executeBatch(allStatements, "Fixtures Load");
    } else {
      for (const stmt of allStatements) {
        await execute(stmt, "Fixtures Load");
      }
    }
  };

  if (this.disableReferentialIntegrity) {
    await this.disableReferentialIntegrity(doInserts);
  } else {
    await doInserts();
  }
}

/**
 * Returns the default empty INSERT value.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#empty_insert_statement_value
 */
export function emptyInsertStatementValue(_primaryKey?: string | null): string {
  return "DEFAULT VALUES";
}

/**
 * Sanitizes a LIMIT value to prevent SQL injection.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#sanitize_limit
 */
export function sanitizeLimit(limit: unknown): number | Nodes.SqlLiteral {
  if (typeof limit === "number" && Number.isInteger(limit)) {
    return limit;
  }
  if (limit && typeof limit === "object" && (limit as any).constructor?.name === "SqlLiteral") {
    return limit as Nodes.SqlLiteral;
  }
  const parsed = Number(limit);
  if (!Number.isInteger(parsed)) {
    throw new TypeError(`Invalid LIMIT: ${limit}`);
  }
  return parsed;
}

/**
 * Converts Hash/Array fixture values to YAML strings, passes scalars through.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#with_yaml_fallback
 */
export function withYamlFallback(value: unknown): unknown {
  if (
    Array.isArray(value) ||
    (value !== null && typeof value === "object" && !(value instanceof Date))
  ) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Returns an Arel SQL literal for CURRENT_TIMESTAMP with the highest
 * available precision. Adapters may override for higher precision.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#high_precision_current_timestamp
 */
export function highPrecisionCurrentTimestamp(): Nodes.SqlLiteral {
  return arelSql("CURRENT_TIMESTAMP");
}

/**
 * Executes a raw query and returns an ActiveRecord::Result.
 * Delegates to rawExecute + castResult.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#raw_exec_query
 */
export async function rawExecQuery(
  this: DatabaseStatementsHost,
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown> {
  if (!this.rawExecute) {
    throw new Error("rawExecQuery requires rawExecute on the adapter");
  }
  const rawResult = await this.rawExecute(sql, name ?? "SQL", binds);
  return this.castResult ? this.castResult(rawResult) : rawResult;
}

/**
 * Executes a query via internal_execute and returns an ActiveRecord::Result.
 * Delegates to internalExecute + castResult.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements#internal_exec_query
 */
export async function internalExecQuery(
  this: DatabaseStatementsHost,
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown> {
  if (this?.internalExecute) {
    const rawResult = await this.internalExecute(sql, name ?? "SQL", binds);
    return this.castResult ? this.castResult(rawResult) : rawResult;
  }
  // Fallback: try execute directly
  return execute(sql, name);
}

// --- Private helpers ---

function singleValueFromRows(rows: unknown[][]): unknown {
  const row = rows[0];
  return row ? row[0] : undefined;
}

/**
 * Alias: create = insert (matches Rails)
 */
export { insert as create };

/**
 * Alias: remove = delete (backwards compat with prior TS API)
 */
export { deleteStatement as remove };
