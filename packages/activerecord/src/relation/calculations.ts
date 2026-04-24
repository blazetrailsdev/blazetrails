/**
 * Calculation methods: count, sum, average, minimum, maximum, pluck, pick, ids.
 *
 * These are the real implementations behind Relation's calculation methods.
 * Each function uses this-typing so it can be assigned to Relation.prototype
 * directly, accessing internal state through `this`.
 *
 * Mirrors: ActiveRecord::Calculations
 */

import { Nodes } from "@blazetrails/arel";
import { BigIntegerType } from "@blazetrails/activemodel";

interface CalculationRelation {
  _modelClass: {
    arelTable: any;
    primaryKey: string | string[];
    adapter: { execute(sql: string): Promise<Record<string, unknown>[]> };
  };
  _limitValue: number | null;
  _offsetValue: number | null;
  _isNone: boolean;
  _isDistinct: boolean;
  _groupColumns: string[];
  _applyJoinsToManager(manager: any): void;
  _applyWheresToManager(manager: any, table: any): void;
  _applyOrderToManager(manager: any, table: any): void;
  toArray(): Promise<any[]>;
}

type AggFn = "count" | "sum" | "average" | "minimum" | "maximum";

const SQL_FN_NAMES: Record<AggFn, string> = {
  count: "COUNT",
  sum: "SUM",
  average: "AVG",
  minimum: "MIN",
  maximum: "MAX",
};

/**
 * Cast an aggregate result value through the column's type.
 *
 * Mirrors Rails' `type_cast_calculated_value` (calculations.rb:627):
 *   - count  → always integer (safe, never exceeds 2^53)
 *   - sum    → type.deserialize(value || 0) — uses column type
 *   - min/max → type.deserialize(value) — uses column type
 *   - average → numeric float (BigDecimal in Rails; kept as number here)
 *
 * For big_integer columns, `BigIntegerType.cast` converts the raw
 * driver string/number/bigint to JS bigint, preserving precision.
 */
function castAggValue(
  val: unknown,
  fn: AggFn,
  column: string,
  rel: CalculationRelation,
  coerceNumeric: boolean,
): unknown {
  const table = rel._modelClass.arelTable as { typeForAttribute?(c: string): unknown };
  const colType = column !== "*" ? table.typeForAttribute?.(column) : null;

  if (!coerceNumeric) {
    // minimum/maximum: route through column type so big_integer columns
    // return bigint rather than the raw driver string/number.
    if (val === null || val === undefined) return null;
    if (colType instanceof BigIntegerType) return colType.cast(val);
    return val;
  }

  if (fn === "sum") {
    // Default for empty result set: 0 or 0n depending on column type.
    if (colType instanceof BigIntegerType) return colType.cast(val ?? 0) ?? 0n;
    return Number(val ?? 0);
  }

  // count / average: always a JS number.
  return Number(val);
}

function buildAggNode(table: any, fn: AggFn, column: string, distinct: boolean): any {
  const sqlName = SQL_FN_NAMES[fn];
  if (column === "*") {
    return new Nodes.NamedFunction(sqlName, [new Nodes.SqlLiteral("*")], undefined, distinct);
  }
  const attr = table.get(column);
  if (distinct) {
    return new Nodes.NamedFunction(sqlName, [attr], undefined, true);
  }
  switch (fn) {
    case "count":
      return attr.count(false);
    case "sum":
      return attr.sum();
    case "average":
      return attr.average();
    case "minimum":
      return attr.minimum();
    case "maximum":
      return attr.maximum();
  }
}

/**
 * Wrap a bigint aggregate SQL in CAST(... AS TEXT) so all adapters
 * return a decimal string. SQLite's SUM/MIN/MAX on computed columns has
 * no declared type, so `safeIntegers` is not enabled — it returns a lossy
 * JS number for values above Number.MAX_SAFE_INTEGER. Wrapping in a
 * subquery with CAST sidesteps that at the SQL level; BigIntegerType.cast
 * then converts the string to bigint with full precision.
 */
function wrapBigintAgg(innerSql: string, grouped = false): string {
  if (grouped) {
    return `SELECT group_key, CAST(val AS TEXT) AS val FROM (${innerSql}) AS _bigint_agg`;
  }
  return `SELECT CAST(val AS TEXT) AS val FROM (${innerSql}) AS _bigint_agg`;
}

function isBigintColumn(rel: CalculationRelation, fn: AggFn, column: string): boolean {
  if (fn === "count" || fn === "average" || column === "*") return false;
  const table = rel._modelClass.arelTable as {
    typeForAttribute?(col: string): unknown;
  };
  return table.typeForAttribute?.(column) instanceof BigIntegerType;
}

async function singleAggregate(
  rel: CalculationRelation,
  fn: AggFn,
  column: string,
  coerceNumeric: boolean = true,
): Promise<unknown | null> {
  const table = rel._modelClass.arelTable;
  const aggNode = buildAggNode(table, fn, column, rel._isDistinct);
  const projection = aggNode.as("val");
  const manager = table.project(projection);
  rel._applyJoinsToManager(manager);
  rel._applyWheresToManager(manager, table);

  const innerSql = manager.toSql();
  const sql = isBigintColumn(rel, fn, column) ? wrapBigintAgg(innerSql) : innerSql;
  const rows = await rel._modelClass.adapter.execute(sql);
  const val = rows[0]?.val;
  if (val === undefined || val === null) {
    return fn === "sum" ? castAggValue(null, fn, column, rel, coerceNumeric) : null;
  }
  return castAggValue(val, fn, column, rel, coerceNumeric);
}

async function groupedAggregate(
  rel: CalculationRelation,
  fn: AggFn,
  column: string,
  coerceNumeric: boolean = true,
): Promise<Record<string, unknown>> {
  const table = rel._modelClass.arelTable;
  const groupCol = rel._groupColumns[0];
  const aggNode = buildAggNode(table, fn, column, rel._isDistinct);
  const manager = table.project(table.get(groupCol).as("group_key"), aggNode.as("val"));
  rel._applyJoinsToManager(manager);
  rel._applyWheresToManager(manager, table);
  manager.group(groupCol);

  if (rel._limitValue !== null) manager.take(rel._limitValue);
  if (rel._offsetValue !== null) manager.skip(rel._offsetValue);

  const innerSql = manager.toSql();
  const sql = isBigintColumn(rel, fn, column) ? wrapBigintAgg(innerSql, true) : innerSql;
  const rows = await rel._modelClass.adapter.execute(sql);

  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const key = String(row.group_key ?? "null");
    const val = row.val;
    if (val === undefined || val === null) {
      result[key] = fn === "sum" ? castAggValue(null, fn, column, rel, coerceNumeric) : null;
    } else {
      result[key] = castAggValue(val, fn, column, rel, coerceNumeric);
    }
  }
  return result;
}

export async function performCount(
  this: CalculationRelation,
  column?: string,
): Promise<number | Record<string, number>> {
  if (this._limitValue === 0) return 0;
  if (this._isNone) return this._groupColumns.length > 0 ? {} : 0;

  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "count", column ?? "*", true) as Promise<Record<string, number>>;
  }

  if (this._limitValue !== null) {
    const rows = await this.toArray();
    return rows.length;
  }

  const table = this._modelClass.arelTable;
  const effectiveColumn = column === "*" ? undefined : column;

  if (effectiveColumn) {
    const countNode = table.get(effectiveColumn).count(this._isDistinct);
    const manager = table.project(countNode.as("count"));
    this._applyJoinsToManager(manager);
    this._applyWheresToManager(manager, table);
    const rows = await this._modelClass.adapter.execute(manager.toSql());
    return Number(rows[0]?.count ?? 0);
  }

  if (this._isDistinct) {
    const pk = this._modelClass.primaryKey;
    if (Array.isArray(pk)) {
      // Multi-column DISTINCT COUNT requires a subquery since
      // COUNT(DISTINCT col1, col2) isn't valid on SQLite/PG
      const innerManager = table.project(...pk.map((c: string) => table.get(c)));
      innerManager.distinct();
      this._applyJoinsToManager(innerManager);
      this._applyWheresToManager(innerManager, table);
      const countAll = new Nodes.NamedFunction("COUNT", [new Nodes.SqlLiteral("*")]);
      const outerManager = table.project(countAll.as("count"));
      outerManager.from(new Nodes.SqlLiteral(`(${innerManager.toSql()}) AS subquery`));
      const rows = await this._modelClass.adapter.execute(outerManager.toSql());
      return Number(rows[0]?.count ?? 0);
    }
    const countNode = table.get(pk).count(true);
    const manager = table.project(countNode.as("count"));
    this._applyJoinsToManager(manager);
    this._applyWheresToManager(manager, table);
    const rows = await this._modelClass.adapter.execute(manager.toSql());
    return Number(rows[0]?.count ?? 0);
  }

  const countAll = new Nodes.NamedFunction("COUNT", [new Nodes.SqlLiteral("*")]);
  const manager = table.project(countAll.as("count"));
  this._applyJoinsToManager(manager);
  this._applyWheresToManager(manager, table);
  const rows = await this._modelClass.adapter.execute(manager.toSql());
  return Number(rows[0]?.count ?? 0);
}

export async function performSum(
  this: CalculationRelation,
  column?: string,
): Promise<number | bigint | Record<string, number | bigint>> {
  if (this._isNone) return this._groupColumns.length > 0 ? {} : 0;
  if (!column) return 0;
  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "sum", column, true) as Promise<Record<string, number | bigint>>;
  }
  return ((await singleAggregate(this, "sum", column, true)) as number | bigint) ?? 0;
}

export async function performAverage(
  this: CalculationRelation,
  column: string,
): Promise<number | null | Record<string, number>> {
  if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "average", column, true) as Promise<Record<string, number>>;
  }
  return singleAggregate(this, "average", column, true) as Promise<number | null>;
}

export async function performMinimum(
  this: CalculationRelation,
  column: string,
): Promise<unknown | null | Record<string, unknown>> {
  if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "minimum", column, false);
  }
  return singleAggregate(this, "minimum", column, false);
}

export async function performMaximum(
  this: CalculationRelation,
  column: string,
): Promise<unknown | null | Record<string, unknown>> {
  if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "maximum", column, false);
  }
  return singleAggregate(this, "maximum", column, false);
}

/**
 * Interface for the calculation methods mixed into Relation.
 * Used with interface merging so the methods appear as proper
 * method signatures in .d.ts output.
 */
export interface CalculationMethods {
  count(column?: string): Promise<number | Record<string, number>>;
  sum(column?: string): Promise<number | bigint | Record<string, number | bigint>>;
  average(column: string): Promise<number | null | Record<string, number>>;
  minimum(column: string): Promise<unknown | null | Record<string, unknown>>;
  maximum(column: string): Promise<unknown | null | Record<string, unknown>>;
}

/**
 * Tracks column aliases during calculation queries to avoid
 * conflicts when multiple aggregates are computed.
 *
 * Mirrors: ActiveRecord::Calculations::ColumnAliasTracker
 */
export const Calculations = {
  count: performCount,
  sum: performSum,
  average: performAverage,
  minimum: performMinimum,
  maximum: performMaximum,
} as const;

export class ColumnAliasTracker {
  private _aliases: Map<string, number> = new Map();

  aliasFor(column: string): string {
    const count = this._aliases.get(column) ?? 0;
    this._aliases.set(column, count + 1);
    if (count === 0) return column;
    return `${column}_${count}`;
  }
}
