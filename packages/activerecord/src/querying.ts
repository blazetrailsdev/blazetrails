/**
 * Querying — find_by_sql, count_by_sql, and delegation of query
 * methods to all().
 *
 * In Rails, this module delegates ~50 query methods to all() and
 * provides find_by_sql/count_by_sql for raw SQL queries.
 *
 * Mirrors: ActiveRecord::Querying
 */

import { sanitizeSql } from "./sanitization.js";

interface QueryingHost {
  name: string;
  adapter: { execute(sql: string): Promise<Record<string, unknown>[]> };
  _instantiate(row: Record<string, unknown>): any;
}

/**
 * Mirrors: ActiveRecord::Querying#find_by_sql
 */
export function findBySql(
  this: QueryingHost,
  sql: string | [string, ...unknown[]],
): Promise<any[]> {
  const sanitized = typeof sql === "string" ? sql : sanitizeSql(sql);
  return this.adapter.execute(sanitized).then((rows) => rows.map((row) => this._instantiate(row)));
}

/**
 * Mirrors: ActiveRecord::Querying#async_find_by_sql
 */
export function asyncFindBySql(
  this: QueryingHost,
  sql: string | [string, ...unknown[]],
): Promise<any[]> {
  return findBySql.call(this, sql);
}

/**
 * Mirrors: ActiveRecord::Querying#count_by_sql
 */
export async function countBySql(
  this: QueryingHost,
  sql: string | [string, ...unknown[]],
): Promise<number> {
  const sanitized = typeof sql === "string" ? sql : sanitizeSql(sql);
  const rows = await this.adapter.execute(sanitized);
  const firstRow = rows[0];
  if (!firstRow) return 0;
  const firstValue = Object.values(firstRow)[0];
  return Number(firstValue) || 0;
}

/**
 * Mirrors: ActiveRecord::Querying#async_count_by_sql
 */
export function asyncCountBySql(
  this: QueryingHost,
  sql: string | [string, ...unknown[]],
): Promise<number> {
  return countBySql.call(this, sql);
}
