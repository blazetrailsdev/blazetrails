/**
 * Calculation methods: count, sum, average, minimum, maximum, pluck, pick, ids.
 *
 * These are the real implementations behind Relation's calculation methods.
 * Each function uses this-typing so it can be assigned to Relation.prototype
 * directly, accessing internal state through `this`.
 *
 * Mirrors: ActiveRecord::Calculations
 */

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

function quoteColumn(tableName: string, column: string): string {
  return `"${tableName}"."${column.replace(/"/g, '""')}"`;
}

async function singleAggregate(
  rel: CalculationRelation,
  fn: string,
  column: string,
  coerceNumeric: boolean = true,
): Promise<unknown | null> {
  const table = rel._modelClass.arelTable;
  const col = quoteColumn(table.name, column);
  const projection = rel._isDistinct ? `${fn}(DISTINCT ${col}) AS val` : `${fn}(${col}) AS val`;
  const manager = table.project(projection);
  rel._applyJoinsToManager(manager);
  rel._applyWheresToManager(manager, table);

  const sql = manager.toSql();
  const rows = await rel._modelClass.adapter.execute(sql);
  const val = rows[0]?.val;
  if (val === undefined || val === null) return null;
  return coerceNumeric ? Number(val) : val;
}

async function groupedAggregate(
  rel: CalculationRelation,
  fn: string,
  column: string,
  coerceNumeric: boolean = true,
): Promise<Record<string, unknown>> {
  const table = rel._modelClass.arelTable;
  const groupCol = rel._groupColumns[0];
  const col = column === "*" ? "*" : quoteColumn(table.name, column);
  const aggExpr = `${fn}(${col}) AS val`;
  const manager = table.project(`${quoteColumn(table.name, groupCol)} AS group_key, ${aggExpr}`);
  rel._applyJoinsToManager(manager);
  rel._applyWheresToManager(manager, table);
  manager.group(groupCol);

  let sql = manager.toSql();
  if (rel._limitValue !== null) sql += ` LIMIT ${rel._limitValue}`;
  if (rel._offsetValue !== null) sql += ` OFFSET ${rel._offsetValue}`;
  const rows = await rel._modelClass.adapter.execute(sql);

  const result: Record<string, unknown> = {};
  for (const row of rows) {
    const key = String(row.group_key ?? "null");
    const val = row.val;
    if (val === undefined || val === null) {
      result[key] = coerceNumeric ? 0 : null;
    } else {
      result[key] = coerceNumeric ? Number(val) : val;
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
    return groupedAggregate(this, "COUNT", column ?? "*", true) as Promise<Record<string, number>>;
  }

  if (this._limitValue !== null) {
    const rows = await this.toArray();
    return rows.length;
  }

  const table = this._modelClass.arelTable;
  let countExpr: string;
  if (column) {
    const col = quoteColumn(table.name, column);
    countExpr = this._isDistinct ? `COUNT(DISTINCT ${col}) AS count` : `COUNT(${col}) AS count`;
  } else if (this._isDistinct) {
    const pk = this._modelClass.primaryKey;
    if (Array.isArray(pk)) {
      // Multi-column DISTINCT COUNT requires a subquery since
      // COUNT(DISTINCT col1, col2) isn't valid on SQLite/PG
      const cols = pk.map((c) => quoteColumn(table.name, c)).join(", ");
      const innerManager = table.project(cols);
      innerManager.distinct();
      this._applyJoinsToManager(innerManager);
      this._applyWheresToManager(innerManager, table);
      const sql = `SELECT COUNT(*) AS count FROM (${innerManager.toSql()}) AS subquery`;
      const rows = await this._modelClass.adapter.execute(sql);
      return Number(rows[0]?.count ?? 0);
    } else {
      countExpr = `COUNT(DISTINCT ${quoteColumn(table.name, pk)}) AS count`;
    }
  } else {
    countExpr = "COUNT(*) AS count";
  }
  const manager = table.project(countExpr);
  this._applyJoinsToManager(manager);
  this._applyWheresToManager(manager, table);

  const sql = manager.toSql();
  const rows = await this._modelClass.adapter.execute(sql);
  return Number(rows[0]?.count ?? 0);
}

export async function performSum(
  this: CalculationRelation,
  column?: string,
): Promise<number | Record<string, number>> {
  if (this._isNone) return this._groupColumns.length > 0 ? {} : 0;
  if (!column) return 0;
  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "SUM", column, true) as Promise<Record<string, number>>;
  }
  return ((await singleAggregate(this, "SUM", column, true)) as number) ?? 0;
}

export async function performAverage(
  this: CalculationRelation,
  column: string,
): Promise<number | null | Record<string, number>> {
  if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "AVG", column, true) as Promise<Record<string, number>>;
  }
  return singleAggregate(this, "AVG", column, true) as Promise<number | null>;
}

export async function performMinimum(
  this: CalculationRelation,
  column: string,
): Promise<unknown | null | Record<string, unknown>> {
  if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "MIN", column, false);
  }
  return singleAggregate(this, "MIN", column, false);
}

export async function performMaximum(
  this: CalculationRelation,
  column: string,
): Promise<unknown | null | Record<string, unknown>> {
  if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
  if (this._groupColumns.length > 0) {
    return groupedAggregate(this, "MAX", column, false);
  }
  return singleAggregate(this, "MAX", column, false);
}

/**
 * Tracks column aliases during calculation queries to avoid
 * conflicts when multiple aggregates are computed.
 *
 * Mirrors: ActiveRecord::Calculations::ColumnAliasTracker
 */
export class ColumnAliasTracker {
  private _aliases: Map<string, number> = new Map();

  aliasFor(column: string): string {
    const count = this._aliases.get(column) ?? 0;
    this._aliases.set(column, count + 1);
    if (count === 0) return column;
    return `${column}_${count}`;
  }
}
