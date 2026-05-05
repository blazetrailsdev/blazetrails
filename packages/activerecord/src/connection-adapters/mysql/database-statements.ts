/**
 * MySQL database statements — MySQL-specific query execution.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements (module)
 */

import type { ExplainOption } from "../../adapter.js";
import type { Nodes } from "@blazetrails/arel";
import { Result } from "../../result.js";

export interface DatabaseStatements {
  execQuery(sql: string, name?: string | null, binds?: unknown[]): Promise<Result>;
  execDelete(sql: string, name?: string | null, binds?: unknown[]): Promise<number>;
  execUpdate(sql: string, name?: string | null, binds?: unknown[]): Promise<number>;
  execInsert(sql: string, name?: string | null, binds?: unknown[], pk?: string): Promise<unknown>;
  explain(sql: string, binds?: unknown[], options?: { extended?: boolean }): Promise<string>;
  lastInsertedId(result: unknown): number;
  highPrecisionCurrentTimestamp(): Nodes.SqlLiteral;
}

// MySQL-specific read-query pattern.
// Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements::READ_QUERY
const READ_QUERY = /^\s*(SELECT|SHOW|EXPLAIN|DESCRIBE|DESC|SET|USE|KILL)\b/i;

/**
 * Returns true when sql is NOT a read query (i.e., is a write).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#write_query?
 * @internal
 */
export function isWriteQuery(sql: string): boolean {
  // Rails rescues ArgumentError from invalid encoding and retries with .b (binary); JS has no equivalent
  return !READ_QUERY.test(sql);
}

export interface BuildExplainClauseHost {
  /** @internal */
  analyzeWithoutExplain?(): boolean;
}

/**
 * Build the EXPLAIN prefix clause for MySQL.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#build_explain_clause
 */
export function buildExplainClause(
  this: BuildExplainClauseHost | void,
  options: ExplainOption[] = [],
): string {
  if (options.length === 0) return "EXPLAIN";
  const clause = `EXPLAIN ${options.map((o) => (typeof o === "string" ? o.toUpperCase() : `FORMAT=${(o as { format: string }).format.toUpperCase()}`)).join(" ")}`;
  // analyzeWithoutExplain? = mariadb? && database_version >= "10.1.0" — not yet wired
  const analyzeWithoutExplain = (this as BuildExplainClauseHost | null)?.analyzeWithoutExplain?.();
  if (analyzeWithoutExplain && clause.includes("ANALYZE")) {
    return clause.replace("EXPLAIN ", "");
  }
  return clause;
}

interface SupportsInsertReturningHost {
  /** @internal */
  supportsInsertReturning?(): boolean;
}

interface AutoIncrementColumnHost {
  autoIncrement?: boolean;
}

/**
 * @internal
 */
export function isAnalyzeWithoutExplain(
  this: { mariaDb?(): boolean; databaseVersion?(): string } | void,
): boolean {
  const host = this as { mariaDb?(): boolean; databaseVersion?(): string } | null;
  if (!host?.mariaDb?.()) return false;
  const version = host.databaseVersion?.() ?? "0.0.0";
  return version >= "10.1.0";
}

/** @internal */
export function defaultInsertValue(_column: AutoIncrementColumnHost): undefined {
  // Rails: `super unless column.auto_increment?` — returns nil/undefined for
  // auto-increment columns so the driver fills the value; delegates to super otherwise.
  if (_column.autoIncrement) return undefined;
  return undefined;
}

/** @internal */
export function returningColumnValues(
  this: SupportsInsertReturningHost | void,
  result: Result,
): unknown[] | undefined {
  if ((this as SupportsInsertReturningHost | null)?.supportsInsertReturning?.()) {
    return result.rows[0] as unknown[] | undefined;
  }
  // Falls back to abstract base behavior (last_inserted_id path)
  return undefined;
}

/** @internal */
export function combineMultiStatements(totalSql: string[]): string[] {
  const maxPacket = 16_777_216; // default 16 MiB; real value comes from show_variable
  return totalSql.reduce<string[]>((chunks, sql) => {
    const prev = chunks[chunks.length - 1];
    if (prev === undefined || sql.length + prev.length + 2 > maxPacket) {
      chunks.push(sql);
    } else {
      chunks[chunks.length - 1] = `${prev};\n${sql}`;
    }
    return chunks;
  }, []);
}

/** @internal */
export function isMaxAllowedPacketReached(
  currentPacket: string,
  previousPacket: string | undefined,
  maxPacket: number,
): boolean {
  if (currentPacket.length > maxPacket) {
    throw new Error(
      `Fixtures set is too large ${currentPacket.length}. Consider increasing the max_allowed_packet variable.`,
    );
  }
  if (previousPacket === undefined) return true;
  return currentPacket.length + previousPacket.length + 2 > maxPacket;
}

/** @internal */
export function maxAllowedPacket(
  this: { showVariable?(name: string): Promise<number> } | void,
): Promise<number> {
  return (
    (this as { showVariable?(name: string): Promise<number> } | null)?.showVariable?.(
      "max_allowed_packet",
    ) ?? Promise.resolve(16_777_216)
  );
}

/**
 * Returns a SQL literal for MySQL's highest-precision current timestamp.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#high_precision_current_timestamp
 */
export function highPrecisionCurrentTimestamp(): string {
  return "CURRENT_TIMESTAMP(6)";
}

/**
 * Returns an EXPLAIN plan for the query.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#explain
 */
export async function explain(
  this: BuildExplainClauseHost & {
    toSql?(arel: unknown, binds?: unknown[]): string;
    internalExecQuery?(sql: string, name?: string, binds?: unknown[]): Promise<Result>;
    explainPrettyPrinter?(): { pp(result: Result, elapsed: number): string };
  },
  arel: unknown,
  binds: unknown[] = [],
  options: ExplainOption[] = [],
): Promise<string> {
  const sql = buildExplainClause.call(this, options) + " " + (this.toSql?.(arel, binds) ?? arel);
  const start = Date.now();
  const result =
    (await this.internalExecQuery?.(String(sql), "EXPLAIN", binds)) ?? new Result([], []);
  const elapsed = (Date.now() - start) / 1000;
  return this.explainPrettyPrinter?.().pp(result, elapsed) ?? JSON.stringify(result.rows);
}
