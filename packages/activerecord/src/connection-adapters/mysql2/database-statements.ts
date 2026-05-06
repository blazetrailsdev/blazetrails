/**
 * Mysql2 database statements — Mysql2-specific query execution overrides.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements (module)
 */

import type mysql from "mysql2/promise";
import { NotImplementedError } from "../../errors.js";
import { Result } from "../../result.js";

export interface DatabaseStatementsHost {
  execQuery(sql: string, name?: string | null, binds?: unknown[]): Promise<Result>;
  preparedStatements?: boolean;
}

/**
 * Opaque raw result returned by performQuery and consumed by castResult / affectedRows.
 * Mirrors the shape of data extracted from a mysql2 query call.
 * @internal
 */
export interface Mysql2RawResult {
  rows: Record<string, unknown>[] | null;
  fields: Array<{ name: string }>;
  affectedRows: number;
  /** Transient prepared statement to close on free (non-cached path). */
  _stmt?: { close?(): void };
}

/** @internal */
interface PerformQueryHost {
  _affectedRowsBeforeWarnings?: number;
  _statements?: Map<string, unknown>;
  handleWarnings?(sql: string): void;
  verified?(): void;
}

/** @internal */
interface MultiStatementsHost {
  _config?: { flags?: string | string[] | number };
}

/**
 * Value of Mysql2::Client::MULTI_STATEMENTS in the Ruby gem — used to test
 * whether the integer form of `flags` has the bit set.
 */
const MULTI_STATEMENTS_BIT = 0x10000;

/**
 * Returns an ActiveRecord::Result instance.
 * Rails also wraps in `unprepared_statement` when collecting EXPLAIN with
 * prepared statements, but that path is deferred pending ExplainRegistry wiring.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements#select_all
 */
export async function selectAll(
  this: DatabaseStatementsHost,
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<Result> {
  // TODO: Rails wraps `super` in `unprepared_statement { ... }` when
  // `ExplainRegistry.collect? && prepared_statements`, so EXPLAIN collection
  // sees literal SQL instead of prepared-statement placeholders. ExplainRegistry
  // is not yet wired in TS — once it lands (see plan PR 58), guard this path
  // with `if (ExplainRegistry.collect && this.preparedStatements) { … unprepared … }`.
  return this.execQuery(sql, name, binds);
}

/** @internal */
function executeBatch(statements: any, name?: any): never {
  throw new NotImplementedError(
    "ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements#execute_batch is not implemented",
  );
}

/** @internal */
function lastInsertedId(result: any): never {
  throw new NotImplementedError(
    "ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements#last_inserted_id is not implemented",
  );
}

/**
 * Returns true if the connection was opened with MULTI_STATEMENTS support.
 * Rails checks `config[:flags]` as either an Array of strings or an integer
 * bitmask. The node-mysql2 driver accepts the same shape via `flags`.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements#multi_statements_enabled?
 * @internal
 */
export function multiStatementsEnabled(this: MultiStatementsHost): boolean {
  const flags = this._config?.flags;
  if (Array.isArray(flags)) return (flags as string[]).includes("MULTI_STATEMENTS");
  if (typeof flags === "number") return (flags & MULTI_STATEMENTS_BIT) !== 0;
  return false;
}

/**
 * Execute `sql` against `rawConnection` and return a Mysql2RawResult.
 *
 * Three execution paths mirror Rails exactly:
 * 1. No binds → `connection.query(sql)` (plain text).
 * 2. `prepare: true` → `connection.execute(sql, typeCastedBinds)` using the
 *    driver's server-side prepared-statement cache.
 * 3. Binds present but `prepare: false` → `connection.execute(sql, typeCastedBinds)`
 *    without caching (transient prepared statement, closed after use).
 *
 * The Rails `set_server_option(OPTION_MULTI_STATEMENTS_{ON,OFF})` toggle for
 * batch mode has no equivalent in node-mysql2 (multi-statements is a
 * connection-creation option only), so that guard is elided here.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements#perform_query
 * @internal
 */
export async function performQuery(
  this: PerformQueryHost,
  rawConnection: mysql.PoolConnection | mysql.Connection,
  sql: string,
  binds: unknown[],
  typeCastedBinds: unknown[],
  options: {
    prepare?: boolean;
    notificationPayload?: Record<string, unknown>;
    batch?: boolean;
  } = {},
): Promise<Mysql2RawResult> {
  const { prepare = false, notificationPayload } = options;
  const hasBinds = binds != null && binds.length > 0;

  let rows: Record<string, unknown>[] | null = null;
  let fields: Array<{ name: string }> = [];
  let affectedRows = 0;

  if (!hasBinds) {
    // No-binds path: plain query, no server-side prepare. Rails notes that
    // avoiding `#affected_rows` when a result is present reduces the chance
    // of a mysql2 bug with concurrent GCed prepared statements (gem 0.5.6).
    const [result, resultFields] = (await rawConnection.query(sql)) as [
      mysql.RowDataPacket[] | mysql.ResultSetHeader,
      mysql.FieldPacket[],
    ];
    if (Array.isArray(result)) {
      rows = result as Record<string, unknown>[];
      fields = (resultFields ?? []) as Array<{ name: string }>;
      affectedRows = rows.length;
    } else {
      affectedRows = (result as mysql.ResultSetHeader).affectedRows ?? 0;
    }
  } else if (prepare) {
    // Cached prepared-statement path. node-mysql2's `execute()` transparently
    // prepares and caches on the server side; the driver manages COM_STMT_CLOSE
    // on connection teardown.
    const [result, resultFields] = (await rawConnection.execute(sql, typeCastedBinds as any[])) as [
      mysql.RowDataPacket[] | mysql.ResultSetHeader,
      mysql.FieldPacket[],
    ];
    if (Array.isArray(result)) {
      rows = result as Record<string, unknown>[];
      fields = (resultFields ?? []) as Array<{ name: string }>;
      affectedRows = rows.length;
    } else {
      affectedRows = (result as mysql.ResultSetHeader).affectedRows ?? 0;
    }
  } else {
    // Non-cached prepared-statement path. node-mysql2 does not expose a
    // "prepare then execute then close" triple as a single API call, so we
    // use `execute()` here too — the driver reuses or evicts server-side
    // statements by SQL text automatically.
    const [result, resultFields] = (await rawConnection.execute(sql, typeCastedBinds as any[])) as [
      mysql.RowDataPacket[] | mysql.ResultSetHeader,
      mysql.FieldPacket[],
    ];
    if (Array.isArray(result)) {
      rows = result as Record<string, unknown>[];
      fields = (resultFields ?? []) as Array<{ name: string }>;
      affectedRows = rows.length;
    } else {
      affectedRows = (result as mysql.ResultSetHeader).affectedRows ?? 0;
    }
  }

  this._affectedRowsBeforeWarnings = affectedRows;

  if (notificationPayload) {
    notificationPayload["affected_rows"] = this._affectedRowsBeforeWarnings;
    notificationPayload["row_count"] = rows?.length ?? 0;
  }

  this.verified?.();
  this.handleWarnings?.(sql);

  return { rows, fields, affectedRows };
}

/**
 * Convert a Mysql2RawResult to an ActiveRecord::Result. Returns an empty
 * Result for mutation queries (no rows/fields).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements#cast_result
 * @internal
 */
export function castResult(rawResult: Mysql2RawResult): Result {
  if (rawResult.rows == null) return Result.empty();

  const fields = rawResult.fields.map((f) => f.name);
  if (fields.length === 0) return Result.empty();

  freeRawResult(rawResult);

  return Result.fromRowHashes(rawResult.rows);
}

/**
 * Return the number of rows affected by the last DML statement. Frees the
 * raw result and returns the value captured during performQuery.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements#affected_rows
 * @internal
 */
export function affectedRows(this: PerformQueryHost, rawResult: Mysql2RawResult): number {
  if (rawResult) freeRawResult(rawResult);
  return this._affectedRowsBeforeWarnings ?? 0;
}

/**
 * Release any resources held by `rawResult`. In the Ruby mysql2 gem,
 * `result.free` releases the C-level result set and `stmt.close` sends
 * COM_STMT_CLOSE. In node-mysql2, result sets are plain JS objects subject
 * to garbage collection, so this is a no-op for rows. Any transient prepared
 * statement attached via `_stmt` is closed if it exposes a `close()` method.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements#free_raw_result
 * @internal
 */
export function freeRawResult(rawResult: Mysql2RawResult): void {
  if (rawResult._stmt) {
    try {
      rawResult._stmt.close?.();
    } catch {
      // swallow — mirrors Rails' rescue Mysql2::Error on stmt close
    }
    rawResult._stmt = undefined;
  }
}
