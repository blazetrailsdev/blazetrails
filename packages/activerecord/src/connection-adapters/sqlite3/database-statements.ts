/**
 * SQLite3 database statements — SQLite-specific query execution.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3::DatabaseStatements
 */

import type { Result } from "../../result.js";

const READ_QUERY =
  /^\s*(SELECT|PRAGMA|EXPLAIN|DESCRIBE|DESC|SHOW|WITH(?:\s+RECURSIVE)?(?:\s+\w+\s+AS\s*\([\s\S]*?\))*\s+SELECT)\b/i;

export interface DatabaseStatements {
  execQuery(sql: string, name?: string | null): Promise<Result>;
  execDelete(sql: string, name?: string | null, binds?: unknown[]): Promise<number>;
  execUpdate(sql: string, name?: string | null, binds?: unknown[]): Promise<number>;
  execInsert(sql: string, name?: string | null, binds?: unknown[], pk?: string): Promise<unknown>;
  explain(sql: string, binds?: unknown[]): Promise<string>;
  lastInsertedId(result: unknown): number;
}

export function isWriteQuery(sql: string): boolean {
  return !READ_QUERY.test(sql);
}

export function beginDbTransaction(): string {
  return "BEGIN IMMEDIATE TRANSACTION";
}

export function beginDeferredTransaction(_isolation?: string | null): string {
  return "BEGIN DEFERRED TRANSACTION";
}

export function beginIsolatedDbTransaction(_isolation: string): string {
  return "BEGIN DEFERRED TRANSACTION";
}

export function commitDbTransaction(): string {
  return "COMMIT TRANSACTION";
}

export function execRollbackDbTransaction(): string {
  return "ROLLBACK TRANSACTION";
}

export function highPrecisionCurrentTimestamp(): string {
  return "STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')";
}

export function execute(sql: string): string {
  return sql;
}

export function resetIsolationLevel(
  adapter: { execute(sql: string, binds?: unknown[]): Promise<unknown> },
  previousReadUncommitted: number | null,
): Promise<void> {
  if (previousReadUncommitted !== null) {
    return adapter.execute(`PRAGMA read_uncommitted=${previousReadUncommitted}`) as Promise<any>;
  }
  return Promise.resolve();
}
