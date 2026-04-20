/**
 * Default DatabaseStatements method bodies — applied to AbstractAdapter
 * (and the test SchemaAdapter) via `include(klass, DatabaseStatements)`.
 *
 * Rails' `ActiveRecord::ConnectionAdapters::DatabaseStatements` is a
 * module mixed into `AbstractAdapter` with `include DatabaseStatements`.
 * This file is the module object for the TS equivalent — shaped so
 * `@blazetrails/activesupport`'s `include()` helper can lift every
 * method onto the target class's prototype.
 *
 * The bodies delegate to the concrete adapter's `execute(sql, binds)`
 * and `executeMutation(sql, binds)` primitives, matching Rails' pattern
 * where the high-level module methods call down into the adapter's
 * `internal_exec_query` / `exec_query` layer.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements
 */

import { isWriteQuerySql } from "../sql-classification.js";
import { Result } from "../../result.js";
import { cacheableQuery } from "./database-statements.js";

interface Host {
  execute(sql: string, binds?: unknown[]): Promise<Record<string, unknown>[]>;
  executeMutation(sql: string, binds?: unknown[]): Promise<number>;
  execQuery(sql: string, name?: string | null, binds?: unknown[]): Promise<Result>;
}

export const DatabaseStatements = {
  async selectAll(
    this: Host,
    sql: string,
    name?: string | null,
    binds?: unknown[],
  ): Promise<Result> {
    // Rails: select_all → internal_exec_query → exec_query. Delegating
    // here means adapters that override execQuery (e.g. PostgreSQLAdapter,
    // which populates columnTypes via its type_map) have their override
    // picked up automatically.
    return this.execQuery(sql, name, binds);
  },

  async selectOne(
    this: Host,
    sql: string,
    _name?: string | null,
    binds?: unknown[],
  ): Promise<Record<string, unknown> | undefined> {
    const rows = await this.execute(sql, binds);
    return rows[0];
  },

  async selectValue(
    this: Host,
    sql: string,
    _name?: string | null,
    binds?: unknown[],
  ): Promise<unknown> {
    const rows = await this.execute(sql, binds);
    if (rows.length === 0) return undefined;
    const keys = Object.keys(rows[0]);
    return keys.length > 0 ? rows[0][keys[0]] : undefined;
  },

  async selectValues(
    this: Host,
    sql: string,
    _name?: string | null,
    binds?: unknown[],
  ): Promise<unknown[]> {
    const rows = await this.execute(sql, binds);
    if (rows.length === 0) return [];
    const firstKey = Object.keys(rows[0])[0];
    if (firstKey === undefined) return rows.map(() => undefined);
    return rows.map((row) => row[firstKey]);
  },

  async selectRows(
    this: Host,
    sql: string,
    _name?: string | null,
    binds?: unknown[],
  ): Promise<unknown[][]> {
    const rows = await this.execute(sql, binds);
    if (rows.length === 0) return [];
    const keys = Object.keys(rows[0]);
    return rows.map((row) => keys.map((key) => row[key]));
  },

  async execQuery(
    this: Host,
    sql: string,
    _name?: string | null,
    binds?: unknown[],
  ): Promise<Result> {
    const rows = await this.execute(sql, binds);
    return Result.fromRowHashes(rows);
  },

  async execInsert(
    this: Host,
    sql: string,
    _name?: string | null,
    binds?: unknown[],
  ): Promise<number> {
    return this.executeMutation(sql, binds);
  },

  async execDelete(
    this: Host,
    sql: string,
    _name?: string | null,
    binds?: unknown[],
  ): Promise<number> {
    return this.executeMutation(sql, binds);
  },

  async execUpdate(
    this: Host,
    sql: string,
    _name?: string | null,
    binds?: unknown[],
  ): Promise<number> {
    return this.executeMutation(sql, binds);
  },

  isWriteQuery(sql: string): boolean {
    return isWriteQuerySql(sql);
  },

  emptyInsertStatementValue(_pk?: string | null): string {
    return "DEFAULT VALUES";
  },

  cacheableQuery(
    this: unknown,
    klass: {
      query?(sql: string): unknown;
      partialQuery?(parts: unknown): unknown;
      partialQueryCollector?(): unknown;
    },
    arel: unknown,
  ): [unknown, unknown[]] {
    return cacheableQuery.call(this as never, klass, arel);
  },
};
