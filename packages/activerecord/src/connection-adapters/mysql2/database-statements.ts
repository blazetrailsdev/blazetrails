/**
 * Mysql2 database statements — Mysql2-specific query execution overrides.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2::DatabaseStatements (module)
 *
 * This module provides mysql2 gem-specific overrides to the shared
 * MySQL::DatabaseStatements. In Rails, mysql2 uses its native result
 * type (Mysql2::Result) rather than the generic ActiveRecord::Result.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Mysql2 {}

export interface DatabaseStatements {
  execQuery(
    sql: string,
    name?: string | null,
    binds?: unknown[],
    prepare?: boolean,
    async?: boolean,
  ): Promise<Record<string, unknown>[]>;
  execDelete(sql: string, name?: string | null, binds?: unknown[]): Promise<number>;
  execUpdate(sql: string, name?: string | null, binds?: unknown[]): Promise<number>;
  execInsert(sql: string, name?: string | null, binds?: unknown[], pk?: string): Promise<unknown>;
}
