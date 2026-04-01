/**
 * Trilogy database statements — Trilogy-specific query execution overrides.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Trilogy::DatabaseStatements (module)
 *
 * This module provides Trilogy-specific overrides to the shared
 * MySQL::DatabaseStatements. Trilogy handles raw result sets slightly
 * differently from mysql2.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Trilogy {}

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
  rawExecute(sql: string, binds?: unknown[], prepare?: boolean): Promise<unknown>;
}
