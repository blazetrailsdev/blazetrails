/**
 * SQLite3 database statements — SQLite-specific query execution.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3::DatabaseStatements
 *
 * In Rails these are instance methods on the DatabaseStatements module
 * mixed into the adapter. Here they're standalone functions that accept
 * an adapter for execution, matching the codebase's mixin pattern.
 */

import type { Result } from "../../result.js";

// Matches Rails' build_read_query_regexp(:pragma) which combines
// DEFAULT_READ_QUERY [:begin, :commit, :explain, :release, :rollback, :savepoint, :select, :with]
// with SQLite3's :pragma addition.
const READ_QUERY =
  /^(?:[(\s]|\/\*[\s\S]*?\*\/)*(?:begin|commit|explain|release|rollback|savepoint|select|with|pragma)\b/i;

type ExecutableAdapter = {
  execute(sql: string, binds?: unknown[]): Promise<unknown>;
};

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

export async function beginDbTransaction(adapter: ExecutableAdapter): Promise<void> {
  await adapter.execute("BEGIN IMMEDIATE TRANSACTION");
}

export async function beginDeferredTransaction(
  adapter: ExecutableAdapter,
  _isolation?: string | null,
): Promise<void> {
  await adapter.execute("BEGIN DEFERRED TRANSACTION");
}

export async function beginIsolatedDbTransaction(
  adapter: ExecutableAdapter,
  _isolation: string,
): Promise<void> {
  await adapter.execute("BEGIN DEFERRED TRANSACTION");
}

export async function commitDbTransaction(adapter: ExecutableAdapter): Promise<void> {
  await adapter.execute("COMMIT TRANSACTION");
}

export async function execRollbackDbTransaction(adapter: ExecutableAdapter): Promise<void> {
  await adapter.execute("ROLLBACK TRANSACTION");
}

export function highPrecisionCurrentTimestamp(): string {
  return "STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')";
}

export async function execute(
  adapter: ExecutableAdapter,
  sql: string,
  binds?: unknown[],
): Promise<unknown> {
  return adapter.execute(sql, binds);
}

export async function resetIsolationLevel(
  adapter: ExecutableAdapter,
  previousReadUncommitted: number | null,
): Promise<void> {
  if (previousReadUncommitted !== null) {
    await adapter.execute(`PRAGMA read_uncommitted=${previousReadUncommitted}`);
  }
}
