/**
 * MySQL database statements — MySQL-specific query execution.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements (module)
 */

import { NotImplementedError } from "../../errors.js";
import type { ExplainOption } from "../../adapter.js";
import type { Nodes } from "@blazetrails/arel";
import type { Result } from "../../result.js";

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
const READ_QUERY = /^\s*(SELECT|SHOW|EXPLAIN|DESCRIBE|DESC|SET|USE|KILL|PRAGMA)\b/i;

/**
 * Returns true when sql is NOT a read query (i.e., is a write).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#write_query?
 * @internal
 */
export function isWriteQuery(sql: string): boolean {
  try {
    return !READ_QUERY.test(sql);
  } catch {
    return !READ_QUERY.test(sql);
  }
}

/**
 * Build the EXPLAIN prefix clause for MySQL.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#build_explain_clause
 */
export function buildExplainClause(options: ExplainOption[] = []): string {
  if (options.length === 0) return "EXPLAIN for:";
  const parts = options.map((o) => {
    if (typeof o === "string") return o.toUpperCase();
    if (o && typeof o === "object" && "format" in o && typeof o.format === "string") {
      return `FORMAT=${o.format.toUpperCase()}`;
    }
    return String(o).toUpperCase();
  });
  return `EXPLAIN ${parts.join(" ")} for:`;
}

/** @internal */
function isAnalyzeWithoutExplain(): never {
  throw new NotImplementedError(
    "ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#analyze_without_explain? is not implemented",
  );
}

/** @internal */
function defaultInsertValue(column: any): never {
  throw new NotImplementedError(
    "ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#default_insert_value is not implemented",
  );
}

/** @internal */
function returningColumnValues(result: any): never {
  throw new NotImplementedError(
    "ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#returning_column_values is not implemented",
  );
}

/** @internal */
function combineMultiStatements(totalSql: any): never {
  throw new NotImplementedError(
    "ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#combine_multi_statements is not implemented",
  );
}

/** @internal */
function isMaxAllowedPacketReached(currentPacket: any, previousPacket: any): never {
  throw new NotImplementedError(
    "ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#max_allowed_packet_reached? is not implemented",
  );
}

/** @internal */
function maxAllowedPacket(): never {
  throw new NotImplementedError(
    "ActiveRecord::ConnectionAdapters::MySQL::DatabaseStatements#max_allowed_packet is not implemented",
  );
}
