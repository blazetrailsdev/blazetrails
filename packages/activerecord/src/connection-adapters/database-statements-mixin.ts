/**
 * DatabaseStatements mixin — adds Rails-compatible query methods to any adapter.
 *
 * Provides default implementations of selectAll, selectOne, selectValue, etc.
 * that delegate to the adapter's execute()/executeMutation() methods.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::DatabaseStatements
 */

import type { DatabaseAdapter } from "../adapter.js";

type AdapterWithStatements = DatabaseAdapter;

/**
 * Adds DatabaseStatements methods to a concrete adapter class.
 * Usage: class MyAdapter extends DatabaseStatementsMixin(BaseClass) { ... }
 */

export function DatabaseStatementsMixin<T extends new (...args: any[]) => any>(Base: T) {
  return class extends Base {
    async selectAll(
      sql: string,
      _name?: string | null,
      binds?: unknown[],
    ): Promise<Record<string, unknown>[]> {
      return (this as unknown as AdapterWithStatements).execute(sql, binds);
    }

    async selectOne(
      sql: string,
      _name?: string | null,
      binds?: unknown[],
    ): Promise<Record<string, unknown> | undefined> {
      const rows = await (this as unknown as AdapterWithStatements).execute(sql, binds);
      return rows[0];
    }

    async selectValue(sql: string, _name?: string | null, binds?: unknown[]): Promise<unknown> {
      const rows = await (this as unknown as AdapterWithStatements).execute(sql, binds);
      if (rows.length === 0) return undefined;
      const keys = Object.keys(rows[0]);
      return keys.length > 0 ? rows[0][keys[0]] : undefined;
    }

    async selectValues(sql: string, _name?: string | null, binds?: unknown[]): Promise<unknown[]> {
      const rows = await (this as unknown as AdapterWithStatements).execute(sql, binds);
      return rows.map((row) => {
        const keys = Object.keys(row);
        return keys.length > 0 ? row[keys[0]] : undefined;
      });
    }

    async selectRows(sql: string, _name?: string | null, binds?: unknown[]): Promise<unknown[][]> {
      const rows = await (this as unknown as AdapterWithStatements).execute(sql, binds);
      return rows.map((row) => Object.values(row));
    }

    async execQuery(
      sql: string,
      _name?: string | null,
      binds?: unknown[],
    ): Promise<Record<string, unknown>[]> {
      return (this as unknown as AdapterWithStatements).execute(sql, binds);
    }

    async execInsert(sql: string, _name?: string | null, binds?: unknown[]): Promise<unknown> {
      return (this as unknown as AdapterWithStatements).executeMutation(sql, binds);
    }

    async execDelete(sql: string, _name?: string | null, binds?: unknown[]): Promise<number> {
      return (this as unknown as AdapterWithStatements).executeMutation(sql, binds);
    }

    async execUpdate(sql: string, _name?: string | null, binds?: unknown[]): Promise<number> {
      return (this as unknown as AdapterWithStatements).executeMutation(sql, binds);
    }

    isWriteQuery(sql: string): boolean {
      const trimmed = sql.trimStart().toUpperCase();
      return (
        !trimmed.startsWith("SELECT") &&
        !trimmed.startsWith("EXPLAIN") &&
        !trimmed.startsWith("PRAGMA") &&
        !trimmed.startsWith("SHOW")
      );
    }

    emptyInsertStatementValue(_pk?: string | null): string {
      return "DEFAULT VALUES";
    }
  };
}
