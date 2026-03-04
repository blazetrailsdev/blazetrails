import { Table, SelectManager, Visitors } from "@rails-js/arel";
import type { Base } from "./base.js";
import { _setRelationCtor } from "./base.js";

/**
 * Relation — the lazy, chainable query interface.
 *
 * Mirrors: ActiveRecord::Relation
 */
export class Relation<T extends Base> {
  private _modelClass: typeof Base;
  private _whereClauses: Array<Record<string, unknown>> = [];
  private _orderClauses: Array<string | [string, "asc" | "desc"]> = [];
  private _limitValue: number | null = null;
  private _offsetValue: number | null = null;
  private _selectColumns: string[] | null = null;
  private _isDistinct = false;
  private _groupColumns: string[] = [];
  private _isNone = false;
  private _loaded = false;
  private _records: T[] = [];

  constructor(modelClass: typeof Base) {
    this._modelClass = modelClass;
  }

  /**
   * Add WHERE conditions. Accepts a hash of column/value pairs.
   *
   * Mirrors: ActiveRecord::Relation#where
   */
  where(conditions: Record<string, unknown>): Relation<T> {
    const rel = this._clone();
    rel._whereClauses.push(conditions);
    return rel;
  }

  /**
   * Add ORDER BY. Accepts column name or { column: "asc"|"desc" }.
   *
   * Mirrors: ActiveRecord::Relation#order
   */
  order(
    ...args: Array<string | Record<string, "asc" | "desc">>
  ): Relation<T> {
    const rel = this._clone();
    for (const arg of args) {
      if (typeof arg === "string") {
        rel._orderClauses.push(arg);
      } else {
        for (const [col, dir] of Object.entries(arg)) {
          rel._orderClauses.push([col, dir]);
        }
      }
    }
    return rel;
  }

  /**
   * Set LIMIT.
   *
   * Mirrors: ActiveRecord::Relation#limit
   */
  limit(value: number): Relation<T> {
    const rel = this._clone();
    rel._limitValue = value;
    return rel;
  }

  /**
   * Set OFFSET.
   *
   * Mirrors: ActiveRecord::Relation#offset
   */
  offset(value: number): Relation<T> {
    const rel = this._clone();
    rel._offsetValue = value;
    return rel;
  }

  /**
   * Select specific columns.
   *
   * Mirrors: ActiveRecord::Relation#select
   */
  select(...columns: string[]): Relation<T> {
    const rel = this._clone();
    rel._selectColumns = columns;
    return rel;
  }

  /**
   * Make the query DISTINCT.
   *
   * Mirrors: ActiveRecord::Relation#distinct
   */
  distinct(): Relation<T> {
    const rel = this._clone();
    rel._isDistinct = true;
    return rel;
  }

  /**
   * Add GROUP BY.
   *
   * Mirrors: ActiveRecord::Relation#group
   */
  group(...columns: string[]): Relation<T> {
    const rel = this._clone();
    rel._groupColumns.push(...columns);
    return rel;
  }

  /**
   * Replace ordering.
   *
   * Mirrors: ActiveRecord::Relation#reorder
   */
  reorder(
    ...args: Array<string | Record<string, "asc" | "desc">>
  ): Relation<T> {
    const rel = this._clone();
    rel._orderClauses = [];
    for (const arg of args) {
      if (typeof arg === "string") {
        rel._orderClauses.push(arg);
      } else {
        for (const [col, dir] of Object.entries(arg)) {
          rel._orderClauses.push([col, dir]);
        }
      }
    }
    return rel;
  }

  /**
   * Reverse the existing order.
   *
   * Mirrors: ActiveRecord::Relation#reverse_order
   */
  reverseOrder(): Relation<T> {
    const rel = this._clone();
    rel._orderClauses = rel._orderClauses.map((clause) => {
      if (typeof clause === "string") {
        return [clause, "desc" as const];
      }
      const [col, dir] = clause;
      return [col, dir === "asc" ? "desc" : "asc"] as [
        string,
        "asc" | "desc",
      ];
    });
    return rel;
  }

  /**
   * Returns a relation that will always produce an empty result.
   *
   * Mirrors: ActiveRecord::Relation#none
   */
  none(): Relation<T> {
    const rel = this._clone();
    rel._isNone = true;
    return rel;
  }

  // -- Terminal methods --

  /**
   * Execute the query and return all records.
   *
   * Mirrors: ActiveRecord::Relation#to_a / #load
   */
  async toArray(): Promise<T[]> {
    if (this._isNone) return [];
    if (this._loaded) return this._records;

    const sql = this._toSql();
    const rows = await this._modelClass.adapter.execute(sql);
    this._records = rows.map(
      (row) => this._modelClass._instantiate(row) as T
    );
    this._loaded = true;
    return this._records;
  }

  /**
   * Return the first record.
   *
   * Mirrors: ActiveRecord::Relation#first
   */
  async first(): Promise<T | null> {
    if (this._isNone) return null;
    const rel = this._clone();
    rel._limitValue = 1;
    const records = await rel.toArray();
    return records[0] ?? null;
  }

  /**
   * Return the last record.
   *
   * Mirrors: ActiveRecord::Relation#last
   */
  async last(): Promise<T | null> {
    if (this._isNone) return null;
    const rel = this.reverseOrder();
    rel._limitValue = 1;
    const records = await rel.toArray();
    return records[0] ?? null;
  }

  /**
   * Count records.
   *
   * Mirrors: ActiveRecord::Relation#count
   */
  async count(): Promise<number> {
    if (this._isNone) return 0;

    const table = this._modelClass.arelTable;
    const manager = table.project("COUNT(*) AS count");
    this._applyWheresToManager(manager, table);

    const sql = manager.toSql();
    const rows = await this._modelClass.adapter.execute(sql);
    return (rows[0]?.count as number) ?? 0;
  }

  /**
   * Check if any records exist.
   *
   * Mirrors: ActiveRecord::Relation#exists?
   */
  async exists(): Promise<boolean> {
    if (this._isNone) return false;
    const c = await this.count();
    return c > 0;
  }

  /**
   * Pluck values for columns.
   *
   * Mirrors: ActiveRecord::Relation#pluck
   */
  async pluck(...columns: string[]): Promise<unknown[]> {
    if (this._isNone) return [];

    const table = this._modelClass.arelTable;
    const projections = columns.map((c) => table.get(c));
    const manager = table.project(...projections);
    this._applyWheresToManager(manager, table);
    this._applyOrderToManager(manager, table);

    if (this._limitValue !== null) manager.take(this._limitValue);
    if (this._offsetValue !== null) manager.skip(this._offsetValue);

    const sql = manager.toSql();
    const rows = await this._modelClass.adapter.execute(sql);

    if (columns.length === 1) {
      return rows.map((row) => row[columns[0]]);
    }
    return rows.map((row) => columns.map((c) => row[c]));
  }

  /**
   * Pluck the primary key values.
   *
   * Mirrors: ActiveRecord::Relation#ids
   */
  async ids(): Promise<unknown[]> {
    return this.pluck(this._modelClass.primaryKey);
  }

  /**
   * Update all matching records.
   *
   * Mirrors: ActiveRecord::Relation#update_all
   */
  async updateAll(updates: Record<string, unknown>): Promise<number> {
    if (this._isNone) return 0;

    const table = this._modelClass.arelTable;
    const setClauses = Object.entries(updates)
      .map(([key, val]) => {
        if (val === null) return `"${key}" = NULL`;
        if (typeof val === "number") return `"${key}" = ${val}`;
        return `"${key}" = '${String(val).replace(/'/g, "''")}'`;
      })
      .join(", ");

    let sql = `UPDATE "${table.name}" SET ${setClauses}`;

    const whereConditions = this._buildWhereStrings(table);
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    return this._modelClass.adapter.executeMutation(sql);
  }

  /**
   * Delete all matching records.
   *
   * Mirrors: ActiveRecord::Relation#delete_all
   */
  async deleteAll(): Promise<number> {
    if (this._isNone) return 0;

    const table = this._modelClass.arelTable;
    let sql = `DELETE FROM "${table.name}"`;

    const whereConditions = this._buildWhereStrings(table);
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    return this._modelClass.adapter.executeMutation(sql);
  }

  // -- SQL generation --

  /**
   * Generate the SQL for this relation.
   */
  toSql(): string {
    return this._toSql();
  }

  private _toSql(): string {
    const table = this._modelClass.arelTable;
    const projections =
      this._selectColumns?.map((c) => table.get(c)) ?? ["*"];
    const manager = table.project(...(projections as any));

    this._applyWheresToManager(manager, table);
    this._applyOrderToManager(manager, table);

    if (this._isDistinct) manager.distinct();
    if (this._limitValue !== null) manager.take(this._limitValue);
    if (this._offsetValue !== null) manager.skip(this._offsetValue);

    for (const col of this._groupColumns) {
      manager.group(col);
    }

    return manager.toSql();
  }

  private _applyWheresToManager(
    manager: SelectManager,
    table: Table
  ): void {
    for (const clause of this._whereClauses) {
      for (const [key, value] of Object.entries(clause)) {
        if (value === null) {
          manager.where(table.get(key).isNull());
        } else if (Array.isArray(value)) {
          manager.where(table.get(key).in(value));
        } else {
          manager.where(table.get(key).eq(value));
        }
      }
    }
  }

  private _applyOrderToManager(
    manager: SelectManager,
    table: Table
  ): void {
    for (const clause of this._orderClauses) {
      if (typeof clause === "string") {
        manager.order(table.get(clause).asc());
      } else {
        const [col, dir] = clause;
        manager.order(
          dir === "desc" ? table.get(col).desc() : table.get(col).asc()
        );
      }
    }
  }

  private _buildWhereStrings(table: Table): string[] {
    const conditions: string[] = [];
    for (const clause of this._whereClauses) {
      for (const [key, value] of Object.entries(clause)) {
        if (value === null) {
          conditions.push(`"${table.name}"."${key}" IS NULL`);
        } else if (typeof value === "number") {
          conditions.push(`"${table.name}"."${key}" = ${value}`);
        } else {
          conditions.push(
            `"${table.name}"."${key}" = '${String(value).replace(/'/g, "''")}'`
          );
        }
      }
    }
    return conditions;
  }

  private _clone(): Relation<T> {
    const rel = new Relation<T>(this._modelClass);
    rel._whereClauses = [...this._whereClauses];
    rel._orderClauses = [...this._orderClauses];
    rel._limitValue = this._limitValue;
    rel._offsetValue = this._offsetValue;
    rel._selectColumns = this._selectColumns
      ? [...this._selectColumns]
      : null;
    rel._isDistinct = this._isDistinct;
    rel._groupColumns = [...this._groupColumns];
    rel._isNone = this._isNone;
    return rel;
  }
}

// Register Relation with Base to break the circular dependency.
_setRelationCtor(Relation as any);
