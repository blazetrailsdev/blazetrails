import { Table, SelectManager, Visitors, Nodes } from "@rails-js/arel";
import type { Base } from "./base.js";
import { _setRelationCtor, _setScopeProxyWrapper } from "./base.js";
import { RecordNotFound, SoleRecordExceeded } from "./errors.js";

/**
 * Range — represents a BETWEEN range for where clauses.
 *
 * Usage: User.where({ age: new Range(18, 30) })
 * Generates: WHERE age BETWEEN 18 AND 30
 */
export class Range {
  readonly begin: unknown;
  readonly end: unknown;

  constructor(begin: unknown, end: unknown) {
    this.begin = begin;
    this.end = end;
  }
}

/**
 * Relation — the lazy, chainable query interface.
 *
 * Mirrors: ActiveRecord::Relation
 */
export class Relation<T extends Base> {
  private _modelClass: typeof Base;
  private _whereClauses: Array<Record<string, unknown>> = [];
  private _whereNotClauses: Array<Record<string, unknown>> = [];
  private _whereRawClauses: string[] = [];
  private _orderClauses: Array<string | [string, "asc" | "desc"]> = [];
  private _rawOrderClauses: string[] = [];
  private _limitValue: number | null = null;
  private _offsetValue: number | null = null;
  private _selectColumns: string[] | null = null;
  private _isDistinct = false;
  private _groupColumns: string[] = [];
  private _orRelations: Relation<T>[] = [];
  private _havingClauses: string[] = [];
  private _isNone = false;
  private _lockValue: string | null = null;
  private _setOperation: { type: "union" | "unionAll" | "intersect" | "except"; other: Relation<T> } | null = null;
  private _joinClauses: Array<{ type: "inner" | "left"; table: string; on: string }> = [];
  private _rawJoins: string[] = [];
  private _includesAssociations: string[] = [];
  private _preloadAssociations: string[] = [];
  private _eagerLoadAssociations: string[] = [];
  private _isReadonly = false;
  private _isStrictLoading = false;
  private _annotations: string[] = [];
  private _fromClause: string | null = null;
  private _createWithAttrs: Record<string, unknown> = {};
  private _extending: Array<Record<string, Function>> = [];
  private _loaded = false;
  private _records: T[] = [];

  constructor(modelClass: typeof Base) {
    this._modelClass = modelClass;
  }

  /**
   * Add WHERE conditions. Accepts a hash of column/value pairs,
   * or a raw SQL string with optional bind values.
   *
   * Mirrors: ActiveRecord::Relation#where
   *
   * Examples:
   *   where({ name: "dean" })
   *   where("age > ?", 18)
   *   where("name LIKE ?", "%dean%")
   */
  where(conditions: Record<string, unknown>): Relation<T>;
  where(sql: string, ...binds: unknown[]): Relation<T>;
  where(conditionsOrSql: Record<string, unknown> | string, ...binds: unknown[]): Relation<T> {
    const rel = this._clone();
    if (typeof conditionsOrSql === "string") {
      // Raw SQL with bind params — substitute ? placeholders
      let sql = conditionsOrSql;
      for (const bind of binds) {
        const replacement = bind === null
          ? "NULL"
          : typeof bind === "number"
            ? String(bind)
            : typeof bind === "boolean"
              ? bind ? "TRUE" : "FALSE"
              : `'${String(bind).replace(/'/g, "''")}'`;
        sql = sql.replace("?", replacement);
      }
      rel._whereRawClauses.push(sql);
    } else {
      rel._whereClauses.push(conditionsOrSql);
    }
    return rel;
  }

  /**
   * Replace all existing WHERE conditions with new ones.
   *
   * Mirrors: ActiveRecord::Relation#rewhere
   */
  rewhere(conditions: Record<string, unknown>): Relation<T> {
    const rel = this._clone();
    // Remove existing clauses for the keys being rewritten
    const keysToReplace = new Set(Object.keys(conditions));
    rel._whereClauses = rel._whereClauses.map((clause) => {
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(clause)) {
        if (!keysToReplace.has(k)) filtered[k] = v;
      }
      return filtered;
    }).filter((c) => Object.keys(c).length > 0);
    rel._whereClauses.push(conditions);
    return rel;
  }

  /**
   * Filter for records WHERE the association IS present (non-null FK).
   *
   * Mirrors: ActiveRecord::Relation#where.associated
   */
  whereAssociated(assocName: string): Relation<T> {
    const modelClass = this._modelClass as any;
    const associations: any[] = modelClass._associations ?? [];
    const assocDef = associations.find((a: any) => a.name === assocName);

    if (assocDef && assocDef.type === "belongsTo") {
      const _underscore = (n: string) => n.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();
      const foreignKey = assocDef.options.foreignKey ?? `${_underscore(assocName)}_id`;
      return this.whereNot({ [foreignKey]: null });
    }
    return this;
  }

  /**
   * Filter for records WHERE the association IS missing (null FK).
   *
   * Mirrors: ActiveRecord::Relation#where.missing
   */
  whereMissing(assocName: string): Relation<T> {
    const modelClass = this._modelClass as any;
    const associations: any[] = modelClass._associations ?? [];
    const assocDef = associations.find((a: any) => a.name === assocName);

    if (assocDef && assocDef.type === "belongsTo") {
      const _underscore = (n: string) => n.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();
      const foreignKey = assocDef.options.foreignKey ?? `${_underscore(assocName)}_id`;
      return this.where({ [foreignKey]: null });
    }
    return this;
  }

  /**
   * Add NOT WHERE conditions. Accepts a hash of column/value pairs.
   *
   * Mirrors: ActiveRecord::Relation#where.not
   */
  whereNot(conditions: Record<string, unknown>): Relation<T> {
    const rel = this._clone();
    rel._whereNotClauses.push(conditions);
    return rel;
  }

  /**
   * Combine this relation with another using OR.
   *
   * Mirrors: ActiveRecord::Relation#or
   */
  or(other: Relation<T>): Relation<T> {
    const rel = this._clone();
    rel._orRelations = [...rel._orRelations, other];
    return rel;
  }

  /**
   * Exclude specific records from the result.
   *
   * Mirrors: ActiveRecord::Relation#excluding / #without
   */
  excluding(...records: T[]): Relation<T> {
    const ids = records.map((r) => r.id).filter((id) => id != null);
    if (ids.length === 0) return this;
    return this.whereNot({ [this._modelClass.primaryKey]: ids });
  }

  /**
   * Alias for excluding.
   *
   * Mirrors: ActiveRecord::Relation#without
   */
  without(...records: T[]): Relation<T> {
    return this.excluding(...records);
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
   * Select specific columns, or filter loaded records with a block.
   *
   * Mirrors: ActiveRecord::Relation#select
   *
   * Examples:
   *   select("name", "email")          // column projection
   *   select("COUNT(*) as total")       // raw SQL expression
   *   select(record => record.active)   // block form (returns array)
   */
  select(fn: (record: T) => boolean): Promise<T[]>;
  select(...columns: string[]): Relation<T>;
  select(...args: any[]): Relation<T> | Promise<T[]> {
    if (args.length === 1 && typeof args[0] === "function") {
      return this.toArray().then((records) => records.filter(args[0]));
    }
    const rel = this._clone();
    rel._selectColumns = args as string[];
    return rel;
  }

  /**
   * Replace existing select columns.
   *
   * Mirrors: ActiveRecord::Relation#reselect
   */
  reselect(...columns: string[]): Relation<T> {
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
   * Add HAVING clause (raw SQL string).
   *
   * Mirrors: ActiveRecord::Relation#having
   */
  having(condition: string): Relation<T> {
    const rel = this._clone();
    rel._havingClauses.push(condition);
    return rel;
  }

  /**
   * Replace GROUP BY columns.
   *
   * Mirrors: ActiveRecord::Relation#regroup
   */
  regroup(...columns: string[]): Relation<T> {
    const rel = this._clone();
    rel._groupColumns = [...columns];
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
   * Order by specific values of a column.
   *
   * Mirrors: ActiveRecord::Relation#in_order_of
   */
  inOrderOf(column: string, values: unknown[]): Relation<T> {
    const rel = this._clone();
    // Generate a CASE WHEN ... expression for ordering
    const cases = values.map((v, i) => {
      const quoted = v === null ? "NULL"
        : typeof v === "number" ? String(v)
        : `'${String(v).replace(/'/g, "''")}'`;
      return `WHEN "${column}" = ${quoted} THEN ${i}`;
    }).join(" ");
    const caseExpr = `CASE ${cases} ELSE ${values.length} END`;
    // Use raw SQL order — push as a string that the order manager treats as raw
    rel._orderClauses = [];
    rel._rawOrderClauses = rel._rawOrderClauses ?? [];
    rel._rawOrderClauses.push(caseExpr);
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

  /**
   * Add a lock clause (FOR UPDATE by default).
   *
   * Mirrors: ActiveRecord::Relation#lock
   */
  lock(clause: string | boolean = true): Relation<T> {
    const rel = this._clone();
    rel._lockValue = clause === true ? "FOR UPDATE" : clause === false ? null : clause;
    return rel;
  }

  /**
   * Mark loaded records as readonly.
   *
   * Mirrors: ActiveRecord::Relation#readonly
   */
  readonly(value = true): Relation<T> {
    const rel = this._clone();
    rel._isReadonly = value;
    return rel;
  }

  /**
   * Enable strict loading — lazily-loaded associations will raise.
   *
   * Mirrors: ActiveRecord::Relation#strict_loading
   */
  strictLoading(value = true): Relation<T> {
    const rel = this._clone();
    rel._isStrictLoading = value;
    return rel;
  }

  /**
   * Add SQL comments to the query.
   *
   * Mirrors: ActiveRecord::Relation#annotate
   */
  annotate(...comments: string[]): Relation<T> {
    const rel = this._clone();
    rel._annotations.push(...comments);
    return rel;
  }

  /**
   * Merge another relation's conditions into this one.
   *
   * Mirrors: ActiveRecord::Relation#merge
   */
  merge(other: Relation<T>): Relation<T> {
    const rel = this._clone();
    rel._whereClauses.push(...other._whereClauses);
    rel._whereNotClauses.push(...other._whereNotClauses);
    rel._whereRawClauses.push(...other._whereRawClauses);
    if (other._orderClauses.length > 0) {
      rel._orderClauses = [...other._orderClauses];
    }
    if (other._limitValue !== null) {
      rel._limitValue = other._limitValue;
    }
    if (other._offsetValue !== null) {
      rel._offsetValue = other._offsetValue;
    }
    if (other._selectColumns) {
      rel._selectColumns = [...other._selectColumns];
    }
    if (other._isDistinct) rel._isDistinct = true;
    if (other._groupColumns.length > 0) {
      rel._groupColumns.push(...other._groupColumns);
    }
    if (other._havingClauses.length > 0) {
      rel._havingClauses.push(...other._havingClauses);
    }
    if (other._lockValue) rel._lockValue = other._lockValue;
    if (other._isReadonly) rel._isReadonly = true;
    if (other._isStrictLoading) rel._isStrictLoading = true;
    rel._joinClauses.push(...other._joinClauses);
    rel._rawJoins.push(...other._rawJoins);
    rel._annotations.push(...other._annotations);
    return rel;
  }

  /**
   * Change the FROM clause (for subqueries or alternate table names).
   *
   * Mirrors: ActiveRecord::Relation#from
   */
  from(source: string): Relation<T> {
    const rel = this._clone();
    rel._fromClause = source;
    return rel;
  }

  /**
   * Set default attributes for create operations on this relation.
   *
   * Mirrors: ActiveRecord::Relation#create_with
   */
  createWith(attrs: Record<string, unknown>): Relation<T> {
    const rel = this._clone();
    rel._createWithAttrs = { ...rel._createWithAttrs, ...attrs };
    return rel;
  }

  /**
   * Remove specific query parts.
   *
   * Mirrors: ActiveRecord::Relation#unscope
   */
  unscope(...types: Array<"where" | "order" | "limit" | "offset" | "group" | "having" | "select" | "distinct" | "lock" | "readonly" | "from">): Relation<T> {
    const rel = this._clone();
    for (const type of types) {
      switch (type) {
        case "where":
          rel._whereClauses = [];
          rel._whereNotClauses = [];
          rel._whereRawClauses = [];
          break;
        case "order":
          rel._orderClauses = [];
          break;
        case "limit":
          rel._limitValue = null;
          break;
        case "offset":
          rel._offsetValue = null;
          break;
        case "group":
          rel._groupColumns = [];
          break;
        case "having":
          rel._havingClauses = [];
          break;
        case "select":
          rel._selectColumns = null;
          break;
        case "distinct":
          rel._isDistinct = false;
          break;
        case "lock":
          rel._lockValue = null;
          break;
        case "readonly":
          rel._isReadonly = false;
          break;
        case "from":
          rel._fromClause = null;
          break;
      }
    }
    return rel;
  }

  /**
   * Add custom methods to this relation instance.
   *
   * Mirrors: ActiveRecord::Relation#extending
   */
  extending(mod: Record<string, Function>): Relation<T> {
    const rel = this._clone();
    rel._extending.push(mod);
    // Apply the methods directly to the proxy target
    for (const [name, fn] of Object.entries(mod)) {
      (rel as any)[name] = fn.bind(rel);
    }
    return rel;
  }

  /**
   * UNION with another relation.
   *
   * Mirrors: ActiveRecord::Relation#union
   */
  union(other: Relation<T>): Relation<T> {
    const rel = this._clone();
    rel._setOperation = { type: "union", other };
    return rel;
  }

  /**
   * UNION ALL with another relation.
   *
   * Mirrors: ActiveRecord::Relation#union_all
   */
  unionAll(other: Relation<T>): Relation<T> {
    const rel = this._clone();
    rel._setOperation = { type: "unionAll", other };
    return rel;
  }

  /**
   * INTERSECT with another relation.
   *
   * Mirrors: ActiveRecord::Relation#intersect
   */
  intersect(other: Relation<T>): Relation<T> {
    const rel = this._clone();
    rel._setOperation = { type: "intersect", other };
    return rel;
  }

  /**
   * EXCEPT with another relation.
   *
   * Mirrors: ActiveRecord::Relation#except_
   */
  except(other: Relation<T>): Relation<T> {
    const rel = this._clone();
    rel._setOperation = { type: "except", other };
    return rel;
  }

  /**
   * Add an INNER JOIN.
   *
   * Mirrors: ActiveRecord::Relation#joins
   */
  joins(tableOrSql: string, on?: string): Relation<T> {
    const rel = this._clone();
    if (on) {
      rel._joinClauses.push({ type: "inner", table: tableOrSql, on });
    } else {
      rel._rawJoins.push(tableOrSql);
    }
    return rel;
  }

  /**
   * Add a LEFT OUTER JOIN.
   *
   * Mirrors: ActiveRecord::Relation#left_joins
   */
  leftJoins(table: string, on: string): Relation<T> {
    const rel = this._clone();
    rel._joinClauses.push({ type: "left", table, on });
    return rel;
  }

  /**
   * Specify associations to be eager loaded (preload strategy).
   *
   * Mirrors: ActiveRecord::Relation#includes
   */
  includes(...associations: string[]): Relation<T> {
    const rel = this._clone();
    rel._includesAssociations.push(...associations);
    return rel;
  }

  /**
   * Specify associations to be preloaded with separate queries.
   *
   * Mirrors: ActiveRecord::Relation#preload
   */
  preload(...associations: string[]): Relation<T> {
    const rel = this._clone();
    rel._preloadAssociations.push(...associations);
    return rel;
  }

  /**
   * Specify associations to be eager loaded.
   *
   * Mirrors: ActiveRecord::Relation#eager_load
   */
  eagerLoad(...associations: string[]): Relation<T> {
    const rel = this._clone();
    rel._eagerLoadAssociations.push(...associations);
    return rel;
  }

  // -- Relation state --

  /**
   * Check if the relation has been loaded.
   *
   * Mirrors: ActiveRecord::Relation#loaded?
   */
  get isLoaded(): boolean {
    return this._loaded;
  }

  /**
   * Reset the relation to force re-query next time.
   *
   * Mirrors: ActiveRecord::Relation#reset
   */
  reset(): this {
    this._loaded = false;
    this._records = [];
    return this;
  }

  /**
   * Returns count if not loaded, length of loaded records if loaded.
   *
   * Mirrors: ActiveRecord::Relation#size
   */
  async size(): Promise<number> {
    if (this._loaded) return this._records.length;
    return this.count() as Promise<number>;
  }

  /**
   * Check if there are no matching records.
   *
   * Mirrors: ActiveRecord::Relation#empty?
   */
  async isEmpty(): Promise<boolean> {
    if (this._loaded) return this._records.length === 0;
    return !(await this.exists());
  }

  /**
   * Check if there are any matching records.
   *
   * Mirrors: ActiveRecord::Relation#any?
   */
  async isAny(): Promise<boolean> {
    if (this._loaded) return this._records.length > 0;
    return this.exists();
  }

  /**
   * Check if there are multiple matching records.
   *
   * Mirrors: ActiveRecord::Relation#many?
   */
  async isMany(): Promise<boolean> {
    if (this._loaded) return this._records.length > 1;
    const c = await this.count();
    return (c as number) > 1;
  }

  /**
   * Return the number of loaded records (alias for toArray().length).
   *
   * Mirrors: ActiveRecord::Relation#length
   */
  async length(): Promise<number> {
    const records = await this.toArray();
    return records.length;
  }

  // -- Terminal methods --

  /**
   * Eagerly load the records and return the relation itself.
   * Useful for chaining: `relation.load().isLoaded` is true.
   *
   * Mirrors: ActiveRecord::Relation#load
   */
  async load(): Promise<this> {
    await this.toArray();
    return this;
  }

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

    // Apply readonly and strict_loading flags to loaded records
    if (this._isReadonly) {
      for (const record of this._records) {
        (record as any)._readonly = true;
      }
    }
    if (this._isStrictLoading) {
      for (const record of this._records) {
        (record as any)._strictLoading = true;
      }
    }

    // Preload associations if requested
    const allAssocs = [
      ...this._includesAssociations,
      ...this._preloadAssociations,
      ...this._eagerLoadAssociations,
    ];
    if (allAssocs.length > 0 && this._records.length > 0) {
      await this._preloadAssociationsForRecords(this._records, allAssocs);
    }

    return this._records;
  }

  /**
   * Return the first record, or first N records when n is given.
   *
   * Mirrors: ActiveRecord::Relation#first
   */
  async first(n?: number): Promise<T | T[] | null> {
    if (this._isNone) return n !== undefined ? [] : null;
    if (n !== undefined) {
      const rel = this._clone();
      rel._limitValue = n;
      return rel.toArray();
    }
    const rel = this._clone();
    rel._limitValue = 1;
    const records = await rel.toArray();
    return records[0] ?? null;
  }

  /**
   * Return the first record, or throw if none found.
   *
   * Mirrors: ActiveRecord::Relation#first!
   */
  async firstBang(): Promise<T> {
    const record = await this.first();
    if (!record) {
      throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
    }
    return record as T;
  }

  /**
   * Return the last record, or last N records when n is given.
   * When no order is specified, defaults to ordering by primary key
   * descending (matching Rails behavior).
   *
   * Mirrors: ActiveRecord::Relation#last
   */
  async last(n?: number): Promise<T | T[] | null> {
    if (this._isNone) return n !== undefined ? [] : null;
    let rel: Relation<T>;
    if (this._orderClauses.length === 0) {
      rel = this.order({ [this._modelClass.primaryKey]: "desc" as const });
    } else {
      rel = this.reverseOrder();
    }
    if (n !== undefined) {
      rel = rel.limit(n);
      const records = await rel.toArray();
      return records.reverse();
    }
    rel = rel.limit(1);
    const records = await rel.toArray();
    return records[0] ?? null;
  }

  /**
   * Return the last record, or throw if none found.
   *
   * Mirrors: ActiveRecord::Relation#last!
   */
  async lastBang(): Promise<T> {
    const record = await this.last();
    if (!record) {
      throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
    }
    return record as T;
  }

  /**
   * Return exactly one record, or raise if zero or more than one.
   *
   * Mirrors: ActiveRecord::Relation#sole
   */
  async sole(): Promise<T> {
    const rel = this._clone();
    rel._limitValue = 2; // Only need 2 to detect "more than one"
    const records = await rel.toArray();
    if (records.length === 0) {
      throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
    }
    if (records.length > 1) {
      throw new SoleRecordExceeded(this._modelClass.name);
    }
    return records[0];
  }

  /**
   * Return the second record.
   *
   * Mirrors: ActiveRecord::Relation#second
   */
  async second(): Promise<T | null> {
    return this._findNthWithLimit(1);
  }

  /**
   * Return the third record.
   *
   * Mirrors: ActiveRecord::Relation#third
   */
  async third(): Promise<T | null> {
    return this._findNthWithLimit(2);
  }

  /**
   * Return the fourth record.
   *
   * Mirrors: ActiveRecord::Relation#fourth
   */
  async fourth(): Promise<T | null> {
    return this._findNthWithLimit(3);
  }

  /**
   * Return the fifth record.
   *
   * Mirrors: ActiveRecord::Relation#fifth
   */
  async fifth(): Promise<T | null> {
    return this._findNthWithLimit(4);
  }

  /**
   * Return the forty-second record.
   *
   * Mirrors: ActiveRecord::Relation#forty_two
   */
  async fortyTwo(): Promise<T | null> {
    return this._findNthWithLimit(41);
  }

  /**
   * Return the second-to-last record.
   *
   * Mirrors: ActiveRecord::Relation#second_to_last
   */
  async secondToLast(): Promise<T | null> {
    return this._findNthFromLast(1);
  }

  /**
   * Return the third-to-last record.
   *
   * Mirrors: ActiveRecord::Relation#third_to_last
   */
  async thirdToLast(): Promise<T | null> {
    return this._findNthFromLast(2);
  }

  private async _findNthWithLimit(index: number): Promise<T | null> {
    const rel = this._clone();
    rel._limitValue = 1;
    rel._offsetValue = (this._offsetValue ?? 0) + index;
    if (rel._orderClauses.length === 0 && rel._rawOrderClauses.length === 0) {
      rel._orderClauses.push(this._modelClass.primaryKey);
    }
    const records = await rel.toArray();
    return records[0] ?? null;
  }

  private async _findNthFromLast(index: number): Promise<T | null> {
    let rel: Relation<T>;
    if (this._orderClauses.length === 0 && this._rawOrderClauses.length === 0) {
      rel = this.order({ [this._modelClass.primaryKey]: "desc" as const });
    } else {
      rel = this.reverseOrder();
    }
    const result = await (rel as any)._findNthWithLimit(index);
    return result;
  }

  /**
   * Return a record without any implicit ordering.
   *
   * Mirrors: ActiveRecord::Relation#take
   */
  async take(limit?: number): Promise<T | T[] | null> {
    const rel = this._clone();
    if (limit !== undefined) {
      rel._limitValue = limit;
      return rel.toArray();
    }
    rel._limitValue = 1;
    const records = await rel.toArray();
    return records[0] ?? null;
  }

  /**
   * Return a record without ordering, or throw if none found.
   *
   * Mirrors: ActiveRecord::Relation#take!
   */
  async takeBang(): Promise<T> {
    const record = await this.take();
    if (!record) {
      throw new RecordNotFound(`${this._modelClass.name} not found`, this._modelClass.name);
    }
    return record as T;
  }

  /**
   * Pick values for columns from the first matching record.
   *
   * Mirrors: ActiveRecord::Relation#pick
   */
  async pick(...columns: string[]): Promise<unknown> {
    const values = await this.limit(1).pluck(...columns);
    return values[0] ?? null;
  }

  /**
   * Return the query execution plan.
   *
   * Mirrors: ActiveRecord::Relation#explain
   */
  async explain(): Promise<string> {
    const sql = this._toSql();
    const adapter = this._modelClass.adapter as any;
    if (typeof adapter.explain === "function") {
      return adapter.explain(sql);
    }
    return `EXPLAIN not supported by this adapter`;
  }

  /**
   * Count records. Optionally count a specific column (ignores NULLs).
   * When used with group(), returns a Record keyed by group value.
   *
   * Mirrors: ActiveRecord::Relation#count
   */
  async count(column?: string): Promise<number | Record<string, number>> {
    if (this._isNone) return this._groupColumns.length > 0 ? {} : 0;

    // Grouped count: SELECT group_col, COUNT(*) FROM ... GROUP BY group_col
    if (this._groupColumns.length > 0) {
      return this._groupedAggregate("COUNT", column ?? "*");
    }

    const table = this._modelClass.arelTable;
    let countExpr: string;
    if (column) {
      const isDistinct = this._isDistinct;
      countExpr = isDistinct
        ? `COUNT(DISTINCT "${table.name}"."${column}") AS count`
        : `COUNT("${table.name}"."${column}") AS count`;
    } else {
      countExpr = this._isDistinct
        ? `COUNT(DISTINCT "${table.name}"."${this._modelClass.primaryKey}") AS count`
        : "COUNT(*) AS count";
    }
    const manager = table.project(countExpr);
    this._applyWheresToManager(manager, table);

    const sql = manager.toSql();
    const rows = await this._modelClass.adapter.execute(sql);
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Sum a column.
   * When used with group(), returns a Record keyed by group value.
   *
   * Mirrors: ActiveRecord::Relation#sum
   */
  async sum(column: string): Promise<number | Record<string, number>> {
    if (this._isNone) return this._groupColumns.length > 0 ? {} : 0;
    if (this._groupColumns.length > 0) {
      return this._groupedAggregate("SUM", column);
    }
    const result = await this._aggregate("SUM", column);
    return result ?? 0;
  }

  /**
   * Average a column.
   * When used with group(), returns a Record keyed by group value.
   *
   * Mirrors: ActiveRecord::Relation#average
   */
  async average(column: string): Promise<number | null | Record<string, number>> {
    if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
    if (this._groupColumns.length > 0) {
      return this._groupedAggregate("AVG", column);
    }
    return this._aggregate("AVG", column);
  }

  /**
   * Minimum value of a column.
   * When used with group(), returns a Record keyed by group value.
   *
   * Mirrors: ActiveRecord::Relation#minimum
   */
  async minimum(column: string): Promise<unknown | Record<string, unknown>> {
    if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
    if (this._groupColumns.length > 0) {
      return this._groupedAggregate("MIN", column);
    }
    return this._aggregate("MIN", column);
  }

  /**
   * Maximum value of a column.
   * When used with group(), returns a Record keyed by group value.
   *
   * Mirrors: ActiveRecord::Relation#maximum
   */
  async maximum(column: string): Promise<unknown | Record<string, unknown>> {
    if (this._isNone) return this._groupColumns.length > 0 ? {} : null;
    if (this._groupColumns.length > 0) {
      return this._groupedAggregate("MAX", column);
    }
    return this._aggregate("MAX", column);
  }

  private async _groupedAggregate(fn: string, column: string): Promise<Record<string, number>> {
    const table = this._modelClass.arelTable;
    const groupCol = this._groupColumns[0]; // Support single group column
    const aggExpr = column === "*"
      ? `${fn}(*) AS val`
      : `${fn}("${table.name}"."${column}") AS val`;
    const manager = table.project(
      `"${table.name}"."${groupCol}" AS group_key, ${aggExpr}`
    );
    this._applyWheresToManager(manager, table);
    manager.group(groupCol);

    const sql = manager.toSql();
    const rows = await this._modelClass.adapter.execute(sql);

    const result: Record<string, number> = {};
    for (const row of rows) {
      const key = String(row.group_key ?? "null");
      result[key] = Number(row.val ?? 0);
    }
    return result;
  }

  private async _aggregate(fn: string, column: string): Promise<number | null> {
    const table = this._modelClass.arelTable;
    const manager = table.project(
      `${fn}("${table.name}"."${column}") AS val`
    );
    this._applyWheresToManager(manager, table);

    const sql = manager.toSql();
    const rows = await this._modelClass.adapter.execute(sql);
    const val = rows[0]?.val;
    return val === undefined || val === null ? null : Number(val);
  }

  /**
   * Check if any records exist, optionally with conditions.
   *
   * Mirrors: ActiveRecord::Relation#exists?
   */
  async exists(conditions?: Record<string, unknown> | unknown): Promise<boolean> {
    if (this._isNone) return false;
    let rel: Relation<T> = this;
    if (conditions !== undefined) {
      if (typeof conditions === "object" && conditions !== null && !Array.isArray(conditions)) {
        rel = this.where(conditions as Record<string, unknown>);
      } else {
        // Primary key lookup
        rel = this.where({ [this._modelClass.primaryKey]: conditions });
      }
    }
    const c = await rel.count();
    return (c as number) > 0;
  }

  /**
   * Generic calculation method.
   *
   * Mirrors: ActiveRecord::Relation#calculate
   */
  async calculate(operation: "count" | "sum" | "average" | "minimum" | "maximum", column?: string): Promise<number | null | Record<string, number>> {
    switch (operation) {
      case "count":
        return this.count(column);
      case "sum":
        return this.sum(column!);
      case "average":
        return this.average(column!);
      case "minimum":
        return this.minimum(column!) as Promise<number | null | Record<string, number>>;
      case "maximum":
        return this.maximum(column!) as Promise<number | null | Record<string, number>>;
      default:
        throw new Error(`Unknown calculation: ${operation}`);
    }
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
   * Destroy all matching records (runs callbacks on each record).
   *
   * Mirrors: ActiveRecord::Relation#destroy_all
   */
  async destroyAll(): Promise<T[]> {
    const records = await this.toArray();
    for (const record of records) {
      await record.destroy();
    }
    return records;
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

  /**
   * Touch all matching records (update timestamps without callbacks).
   *
   * Mirrors: ActiveRecord::Relation#touch_all
   */
  async touchAll(...names: string[]): Promise<number> {
    if (this._isNone) return 0;

    const now = new Date();
    const updates: Record<string, unknown> = {};

    // Always touch updated_at if defined on the model
    if (this._modelClass._attributeDefinitions.has("updated_at")) {
      updates.updated_at = `'${now.toISOString()}'`;
    }
    for (const name of names) {
      updates[name] = `'${now.toISOString()}'`;
    }

    if (Object.keys(updates).length === 0) return 0;

    const table = this._modelClass.arelTable;
    const setClauses = Object.entries(updates)
      .map(([key, val]) => `"${key}" = ${val}`)
      .join(", ");

    let sql = `UPDATE "${table.name}" SET ${setClauses}`;

    const whereConditions = this._buildWhereStrings(table);
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    return this._modelClass.adapter.executeMutation(sql);
  }

  /**
   * Find the first record matching conditions within this relation, or create one.
   *
   * Mirrors: ActiveRecord::Relation#find_or_create_by
   */
  async findOrCreateBy(
    conditions: Record<string, unknown>,
    extra?: Record<string, unknown>
  ): Promise<T> {
    const records = await this.where(conditions).limit(1).toArray();
    if (records.length > 0) return records[0];
    return this._modelClass.create({ ...this._createWithAttrs, ...this._scopeAttributes(), ...conditions, ...extra }) as Promise<T>;
  }

  /**
   * Find the first record matching conditions within this relation, or instantiate one (unsaved).
   *
   * Mirrors: ActiveRecord::Relation#find_or_initialize_by
   */
  async findOrInitializeBy(
    conditions: Record<string, unknown>,
    extra?: Record<string, unknown>
  ): Promise<T> {
    const records = await this.where(conditions).limit(1).toArray();
    if (records.length > 0) return records[0];
    return new (this._modelClass as any)({ ...this._scopeAttributes(), ...conditions, ...extra }) as T;
  }

  /**
   * Insert multiple records in a single INSERT statement (skip callbacks/validations).
   *
   * Mirrors: ActiveRecord::Base.insert_all
   */
  async insertAll(
    records: Record<string, unknown>[],
    options?: { uniqueBy?: string | string[] }
  ): Promise<number> {
    if (records.length === 0) return 0;

    const table = this._modelClass.arelTable;
    const columns = Object.keys(records[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");

    const valueRows = records.map((row) => {
      const vals = columns.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `(${vals.join(", ")})`;
    });

    let sql = `INSERT INTO "${table.name}" (${colList}) VALUES ${valueRows.join(", ")}`;

    if (options?.uniqueBy) {
      const uniqueCols = Array.isArray(options.uniqueBy) ? options.uniqueBy : [options.uniqueBy];
      sql += ` ON CONFLICT (${uniqueCols.map(c => `"${c}"`).join(", ")}) DO NOTHING`;
    }

    return this._modelClass.adapter.executeMutation(sql);
  }

  /**
   * Upsert multiple records in a single statement (skip callbacks/validations).
   *
   * Mirrors: ActiveRecord::Base.upsert_all
   */
  async upsertAll(
    records: Record<string, unknown>[],
    options?: { uniqueBy?: string | string[] }
  ): Promise<number> {
    if (records.length === 0) return 0;

    const table = this._modelClass.arelTable;
    const columns = Object.keys(records[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");

    const valueRows = records.map((row) => {
      const vals = columns.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `(${vals.join(", ")})`;
    });

    const uniqueCols = options?.uniqueBy
      ? (Array.isArray(options.uniqueBy) ? options.uniqueBy : [options.uniqueBy])
      : [this._modelClass.primaryKey];

    const updateCols = columns.filter((c) => !uniqueCols.includes(c));
    const updateClause = updateCols.length > 0
      ? updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")
      : `"${columns[0]}" = EXCLUDED."${columns[0]}"`;

    const sql = `INSERT INTO "${table.name}" (${colList}) VALUES ${valueRows.join(", ")} ON CONFLICT (${uniqueCols.map(c => `"${c}"`).join(", ")}) DO UPDATE SET ${updateClause}`;

    return this._modelClass.adapter.executeMutation(sql);
  }

  /**
   * Extract scope attributes from the where clauses (for find_or_create_by).
   */
  private _scopeAttributes(): Record<string, unknown> {
    const attrs: Record<string, unknown> = {};
    for (const clause of this._whereClauses) {
      for (const [key, value] of Object.entries(clause)) {
        if (value !== null && !Array.isArray(value) && !(value instanceof Range)) {
          attrs[key] = value;
        }
      }
    }
    return attrs;
  }

  // -- Batches --

  /**
   * Yields arrays of records in batches.
   *
   * Mirrors: ActiveRecord::Relation#find_in_batches
   */
  async *findInBatches({ batchSize = 1000 }: { batchSize?: number } = {}): AsyncGenerator<T[]> {
    let currentOffset = this._offsetValue ?? 0;

    while (true) {
      const rel = this._clone();
      rel._limitValue = batchSize;
      rel._offsetValue = currentOffset;
      rel._loaded = false;

      // Ensure deterministic ordering
      if (rel._orderClauses.length === 0) {
        rel._orderClauses.push(this._modelClass.primaryKey);
      }

      const batch = await rel.toArray();
      if (batch.length === 0) break;

      yield batch;

      if (batch.length < batchSize) break;
      currentOffset += batchSize;
    }
  }

  /**
   * Yields individual records in batches for memory efficiency.
   *
   * Mirrors: ActiveRecord::Relation#find_each
   */
  async *findEach({ batchSize = 1000 }: { batchSize?: number } = {}): AsyncGenerator<T> {
    for await (const batch of this.findInBatches({ batchSize })) {
      for (const record of batch) {
        yield record;
      }
    }
  }

  // -- SQL generation --

  /**
   * Generate the SQL for this relation.
   */
  toSql(): string {
    return this._toSql();
  }

  private _toSql(): string {
    // Set operations: generate both sides and combine
    if (this._setOperation) {
      const leftSql = this._toSqlWithoutSetOp();
      const rightSql = this._setOperation.other._toSqlWithoutSetOp();
      const op = {
        union: "UNION",
        unionAll: "UNION ALL",
        intersect: "INTERSECT",
        except: "EXCEPT",
      }[this._setOperation.type];
      return `(${leftSql}) ${op} (${rightSql})`;
    }
    return this._toSqlWithoutSetOp();
  }

  private _toSqlWithoutSetOp(): string {
    const table = this._modelClass.arelTable;
    const projections = this._selectColumns
      ? this._selectColumns.map((c) => {
          // If the column contains special chars (parens, spaces, *), treat as raw SQL
          if (/[(*\s]/.test(c)) return new Nodes.SqlLiteral(c);
          return table.get(c);
        })
      : ["*"];
    const manager = table.project(...(projections as any));

    // Apply joins
    for (const join of this._joinClauses) {
      const onNode = new Nodes.SqlLiteral(join.on);
      if (join.type === "inner") {
        manager.join(join.table, onNode);
      } else {
        manager.outerJoin(join.table, onNode);
      }
    }
    for (const rawJoin of this._rawJoins) {
      manager.join(rawJoin);
    }

    this._applyWheresToManager(manager, table);
    this._applyOrderToManager(manager, table);

    if (this._isDistinct) manager.distinct();
    if (this._limitValue !== null) manager.take(this._limitValue);
    if (this._offsetValue !== null) manager.skip(this._offsetValue);

    for (const col of this._groupColumns) {
      manager.group(col);
    }

    for (const clause of this._havingClauses) {
      manager.having(new Nodes.SqlLiteral(clause));
    }

    if (this._lockValue) {
      manager.lock(this._lockValue);
    }

    let sql = manager.toSql();

    // Replace FROM clause if from() was used
    if (this._fromClause) {
      sql = sql.replace(
        /FROM\s+"[^"]+"/,
        `FROM ${this._fromClause}`
      );
    }

    // Append SQL comments from annotate()
    if (this._annotations.length > 0) {
      const comments = this._annotations.map((c) => `/* ${c} */`).join(" ");
      sql = `${sql} ${comments}`;
    }

    return sql;
  }

  private _buildWhereNodes(
    table: Table,
    whereClauses: Array<Record<string, unknown>>,
    whereNotClauses: Array<Record<string, unknown>>
  ): Nodes.Node[] {
    const nodes: Nodes.Node[] = [];
    for (const clause of whereClauses) {
      for (const [key, value] of Object.entries(clause)) {
        if (value === null) {
          nodes.push(table.get(key).isNull());
        } else if (value instanceof Range) {
          nodes.push(table.get(key).between(value.begin, value.end));
        } else if (Array.isArray(value)) {
          nodes.push(table.get(key).in(value));
        } else {
          nodes.push(table.get(key).eq(value));
        }
      }
    }
    for (const clause of whereNotClauses) {
      for (const [key, value] of Object.entries(clause)) {
        if (value === null) {
          nodes.push(table.get(key).isNotNull());
        } else if (Array.isArray(value)) {
          nodes.push(table.get(key).notIn(value));
        } else {
          nodes.push(table.get(key).notEq(value));
        }
      }
    }
    return nodes;
  }

  private _combineNodes(nodes: Nodes.Node[]): Nodes.Node | null {
    if (nodes.length === 0) return null;
    if (nodes.length === 1) return nodes[0];
    return new Nodes.And(nodes);
  }

  private _applyWheresToManager(
    manager: SelectManager,
    table: Table
  ): void {
    if (this._orRelations.length > 0) {
      // Collect all branches: this relation's wheres + each OR relation's wheres
      const allBranches: (Nodes.Node | null)[] = [
        this._combineNodes(this._buildWhereNodes(table, this._whereClauses, this._whereNotClauses)),
      ];
      for (const orRel of this._orRelations) {
        allBranches.push(
          this._combineNodes(this._buildWhereNodes(table, orRel._whereClauses, orRel._whereNotClauses))
        );
      }
      const nonNull = allBranches.filter((n): n is Nodes.Node => n !== null);
      if (nonNull.length > 0) {
        const combined = nonNull.reduce((left, right) => new Nodes.Or(left, right));
        manager.where(new Nodes.Grouping(combined));
      }
      return;
    }

    for (const clause of this._whereClauses) {
      for (const [key, value] of Object.entries(clause)) {
        if (value === null) {
          manager.where(table.get(key).isNull());
        } else if (value instanceof Range) {
          manager.where(table.get(key).between(value.begin, value.end));
        } else if (Array.isArray(value)) {
          manager.where(table.get(key).in(value));
        } else {
          manager.where(table.get(key).eq(value));
        }
      }
    }
    for (const clause of this._whereNotClauses) {
      for (const [key, value] of Object.entries(clause)) {
        if (value === null) {
          manager.where(table.get(key).isNotNull());
        } else if (Array.isArray(value)) {
          manager.where(table.get(key).notIn(value));
        } else {
          manager.where(table.get(key).notEq(value));
        }
      }
    }
    // Raw SQL WHERE clauses
    for (const rawClause of this._whereRawClauses) {
      manager.where(new Nodes.SqlLiteral(rawClause));
    }
  }

  private _applyOrderToManager(
    manager: SelectManager,
    table: Table
  ): void {
    // Raw order clauses (from inOrderOf)
    for (const rawClause of this._rawOrderClauses) {
      manager.order(new Nodes.SqlLiteral(rawClause));
    }
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
        } else if (value instanceof Range) {
          const begin = typeof value.begin === "number" ? String(value.begin) : `'${String(value.begin).replace(/'/g, "''")}'`;
          const end = typeof value.end === "number" ? String(value.end) : `'${String(value.end).replace(/'/g, "''")}'`;
          conditions.push(`"${table.name}"."${key}" BETWEEN ${begin} AND ${end}`);
        } else if (typeof value === "boolean") {
          conditions.push(
            `"${table.name}"."${key}" = ${value ? "TRUE" : "FALSE"}`
          );
        } else if (typeof value === "number") {
          conditions.push(`"${table.name}"."${key}" = ${value}`);
        } else if (Array.isArray(value)) {
          const vals = value
            .map((v) => {
              if (v === null) return "NULL";
              if (typeof v === "number") return String(v);
              return `'${String(v).replace(/'/g, "''")}'`;
            })
            .join(", ");
          conditions.push(`"${table.name}"."${key}" IN (${vals})`);
        } else {
          conditions.push(
            `"${table.name}"."${key}" = '${String(value).replace(/'/g, "''")}'`
          );
        }
      }
    }
    for (const clause of this._whereNotClauses) {
      for (const [key, value] of Object.entries(clause)) {
        if (value === null) {
          conditions.push(`"${table.name}"."${key}" IS NOT NULL`);
        } else if (typeof value === "boolean") {
          conditions.push(
            `"${table.name}"."${key}" != ${value ? "TRUE" : "FALSE"}`
          );
        } else if (typeof value === "number") {
          conditions.push(`"${table.name}"."${key}" != ${value}`);
        } else if (Array.isArray(value)) {
          const vals = value
            .map((v) => {
              if (v === null) return "NULL";
              if (typeof v === "number") return String(v);
              return `'${String(v).replace(/'/g, "''")}'`;
            })
            .join(", ");
          conditions.push(`"${table.name}"."${key}" NOT IN (${vals})`);
        } else {
          conditions.push(
            `"${table.name}"."${key}" != '${String(value).replace(/'/g, "''")}'`
          );
        }
      }
    }
    // Raw SQL WHERE clauses
    for (const rawClause of this._whereRawClauses) {
      conditions.push(rawClause);
    }
    return conditions;
  }

  private async _preloadAssociationsForRecords(records: T[], assocNames: string[]): Promise<void> {
    const modelClass = this._modelClass as any;
    const associations: any[] = modelClass._associations ?? [];

    for (const assocName of assocNames) {
      const assocDef = associations.find((a: any) => a.name === assocName);
      if (!assocDef) continue;

      const { loadBelongsTo: _lb, loadHasMany: _lm, loadHasOne: _lo, modelRegistry: _mr } =
        await import("./associations.js");

      if (assocDef.type === "belongsTo") {
        const _underscore = (n: string) => n.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();
        const className = assocDef.options.className ??
          assocName.charAt(0).toUpperCase() + assocName.slice(1);
        const foreignKey = assocDef.options.foreignKey ?? `${_underscore(assocName)}_id`;
        const primaryKey = assocDef.options.primaryKey ?? "id";

        const fkValues = [...new Set(records.map(r => r.readAttribute(foreignKey)).filter(v => v != null))];
        if (fkValues.length === 0) continue;

        const targetModel = _mr.get(className);
        if (!targetModel) continue;

        const related = await (targetModel as any).all().where({ [primaryKey]: fkValues }).toArray();
        const relatedMap = new Map<unknown, any>();
        for (const r of related) relatedMap.set(r.readAttribute(primaryKey), r);

        for (const record of records) {
          if (!(record as any)._preloadedAssociations) (record as any)._preloadedAssociations = new Map();
          (record as any)._preloadedAssociations.set(assocName, relatedMap.get(record.readAttribute(foreignKey)) ?? null);
        }
      } else if (assocDef.type === "hasMany") {
        const singularize = (w: string) => {
          if (w.endsWith("ies")) return w.slice(0, -3) + "y";
          if (w.endsWith("ses") || w.endsWith("xes") || w.endsWith("zes")) return w.slice(0, -2);
          if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
          return w;
        };
        const camelize = (n: string) => n.split("_").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
        const underscore = (n: string) => n.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();

        const className = assocDef.options.className ?? camelize(singularize(assocName));
        const foreignKey = assocDef.options.foreignKey ?? `${underscore(modelClass.name)}_id`;
        const primaryKey = assocDef.options.primaryKey ?? modelClass.primaryKey;

        // Handle through associations
        if (assocDef.options.through) {
          const throughAssocDef = associations.find((a: any) => a.name === assocDef.options.through);
          if (!throughAssocDef) continue;

          const throughClassName = throughAssocDef.options.className ??
            camelize(singularize(throughAssocDef.name));
          const throughModel = _mr.get(throughClassName);
          if (!throughModel) continue;

          const throughFk = throughAssocDef.options.foreignKey ?? `${underscore(modelClass.name)}_id`;
          const pkValues = [...new Set(records.map(r => r.readAttribute(primaryKey)).filter(v => v != null))];
          if (pkValues.length === 0) continue;

          const throughRecords = await (throughModel as any).all().where({ [throughFk]: pkValues }).toArray();

          const sourceName = assocDef.options.source ?? singularize(assocName);
          const targetFk = `${underscore(sourceName)}_id`;
          const targetModel = _mr.get(className);
          if (!targetModel) continue;

          const targetIds = [...new Set(throughRecords.map((r: any) => r.readAttribute(targetFk)).filter((v: any) => v != null))];
          const targetRecords = targetIds.length > 0 ? await (targetModel as any).all().where({ id: targetIds }).toArray() : [];
          const targetMap = new Map<unknown, any>();
          for (const r of targetRecords) targetMap.set(r.readAttribute("id"), r);

          for (const record of records) {
            if (!(record as any)._preloadedAssociations) (record as any)._preloadedAssociations = new Map();
            const pkVal = record.readAttribute(primaryKey);
            const myThroughRecords = throughRecords.filter((tr: any) => tr.readAttribute(throughFk) == pkVal);
            const myTargets = myThroughRecords.map((tr: any) => targetMap.get(tr.readAttribute(targetFk))).filter(Boolean);
            (record as any)._preloadedAssociations.set(assocName, myTargets);
          }
          continue;
        }

        const pkValues = [...new Set(records.map(r => r.readAttribute(primaryKey)).filter(v => v != null))];
        if (pkValues.length === 0) continue;

        const targetModel = _mr.get(className);
        if (!targetModel) continue;

        const related = await (targetModel as any).all().where({ [foreignKey]: pkValues }).toArray();
        const relatedMap = new Map<unknown, any[]>();
        for (const r of related) {
          const fk = r.readAttribute(foreignKey);
          if (!relatedMap.has(fk)) relatedMap.set(fk, []);
          relatedMap.get(fk)!.push(r);
        }

        for (const record of records) {
          if (!(record as any)._preloadedAssociations) (record as any)._preloadedAssociations = new Map();
          (record as any)._preloadedAssociations.set(assocName, relatedMap.get(record.readAttribute(primaryKey)) ?? []);
        }
      } else if (assocDef.type === "hasOne") {
        const underscore = (n: string) => n.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();
        const camelize = (n: string) => n.split("_").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");

        const className = assocDef.options.className ?? camelize(assocName);
        const foreignKey = assocDef.options.foreignKey ?? `${underscore(modelClass.name)}_id`;
        const primaryKey = assocDef.options.primaryKey ?? modelClass.primaryKey;

        const pkValues = [...new Set(records.map(r => r.readAttribute(primaryKey)).filter(v => v != null))];
        if (pkValues.length === 0) continue;

        const targetModel = _mr.get(className);
        if (!targetModel) continue;

        const related = await (targetModel as any).all().where({ [foreignKey]: pkValues }).toArray();
        const relatedMap = new Map<unknown, any>();
        for (const r of related) relatedMap.set(r.readAttribute(foreignKey), r);

        for (const record of records) {
          if (!(record as any)._preloadedAssociations) (record as any)._preloadedAssociations = new Map();
          (record as any)._preloadedAssociations.set(assocName, relatedMap.get(record.readAttribute(primaryKey)) ?? null);
        }
      }
    }
  }

  /** @internal */
  _clone(): Relation<T> {
    const rel = new Relation<T>(this._modelClass);
    rel._whereClauses = [...this._whereClauses];
    rel._whereNotClauses = [...this._whereNotClauses];
    rel._whereRawClauses = [...this._whereRawClauses];
    rel._orderClauses = [...this._orderClauses];
    rel._rawOrderClauses = [...this._rawOrderClauses];
    rel._limitValue = this._limitValue;
    rel._offsetValue = this._offsetValue;
    rel._selectColumns = this._selectColumns
      ? [...this._selectColumns]
      : null;
    rel._isDistinct = this._isDistinct;
    rel._groupColumns = [...this._groupColumns];
    rel._havingClauses = [...this._havingClauses];
    rel._orRelations = [...this._orRelations];
    rel._isNone = this._isNone;
    rel._lockValue = this._lockValue;
    rel._setOperation = this._setOperation;
    rel._joinClauses = [...this._joinClauses];
    rel._rawJoins = [...this._rawJoins];
    rel._includesAssociations = [...this._includesAssociations];
    rel._preloadAssociations = [...this._preloadAssociations];
    rel._eagerLoadAssociations = [...this._eagerLoadAssociations];
    rel._isReadonly = this._isReadonly;
    rel._isStrictLoading = this._isStrictLoading;
    rel._annotations = [...this._annotations];
    rel._fromClause = this._fromClause;
    rel._createWithAttrs = { ...this._createWithAttrs };
    rel._extending = [...this._extending];
    return wrapWithScopeProxy(rel);
  }
}

/**
 * Wrap a Relation in a Proxy that delegates scope names
 * to the model's registered scopes.
 */
function wrapWithScopeProxy<T extends Base>(rel: Relation<T>): Relation<T> {
  return new Proxy(rel, {
    get(target: any, prop: string | symbol, receiver: any) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === "symbol") return value;
      if (value !== undefined) return value;
      if (prop in target) return value;

      // Check if this is a scope on the model class
      const modelClass = target._modelClass as typeof Base;
      if (modelClass._scopes.has(prop as string)) {
        return (...args: any[]) => {
          const scopeFn = modelClass._scopes.get(prop as string)!;
          return scopeFn(target, ...args);
        };
      }
      return value;
    },
  });
}

// Register Relation with Base to break the circular dependency.
_setRelationCtor(Relation as any);
_setScopeProxyWrapper(wrapWithScopeProxy);
