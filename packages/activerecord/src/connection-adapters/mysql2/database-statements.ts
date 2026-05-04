/**
 * Mysql2 database statements — Mysql2-specific query execution overrides.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements (module)
 */

import { NotImplementedError } from "../../errors.js";
import type { Result } from "../../result.js";

export interface DatabaseStatementsHost {
  execQuery(sql: string, name?: string | null, binds?: unknown[]): Promise<Result>;
  preparedStatements?: boolean;
}

/**
 * Returns an ActiveRecord::Result instance.
 * When collecting EXPLAIN and using prepared statements, runs the query
 * without prepared-statement mode to allow explain collection.
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
