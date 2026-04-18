/**
 * StatementCache — cache a single statement to avoid rebuilding the AST.
 *
 * Mirrors: ActiveRecord::StatementCache
 *
 * Usage:
 *   const cache = StatementCache.create(connection, (params) => {
 *     return Model.where({ name: params.bind() });
 *   });
 *   const results = await cache.execute(["my book"], connection);
 */

import type { Base } from "./base.js";

/**
 * Placeholder for bind values in cached statements.
 * Mirrors: ActiveRecord::StatementCache::Substitute
 */
export class Substitute {}

/**
 * Wraps a fixed SQL string for prepared statement execution.
 * Mirrors: ActiveRecord::StatementCache::Query
 */
export class Query {
  readonly retryable: boolean;
  private _sql: string;

  constructor(sql: string, options: { retryable?: boolean } = {}) {
    this._sql = sql;
    this.retryable = options.retryable ?? false;
  }

  sqlFor(_binds: unknown[], _connection: unknown): string {
    return this._sql;
  }
}

/**
 * SQL template with Substitute slots for value interpolation.
 * Mirrors: ActiveRecord::StatementCache::PartialQuery
 */
export class PartialQuery extends Query {
  private _values: unknown[];
  private _indexes: number[];

  constructor(values: unknown[], options: { retryable?: boolean } = {}) {
    super("", options);
    this._values = values;
    this._indexes = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] instanceof Substitute) {
        this._indexes.push(i);
      }
    }
  }

  override sqlFor(binds: unknown[], connection: { quote?(value: unknown): string }): string {
    const val = [...this._values];
    const bindsCopy = [...binds];
    for (const i of this._indexes) {
      let value = bindsCopy.shift();
      if (value && typeof value === "object" && "valueForDatabase" in value) {
        value = (value as { valueForDatabase(): unknown }).valueForDatabase();
      }
      val[i] = connection.quote ? connection.quote(value) : quoteValue(value);
    }
    return val.join("");
  }
}

/**
 * Collects SQL parts and binds during AST compilation for PartialQuery.
 * Mirrors: ActiveRecord::StatementCache::PartialQueryCollector
 */
export class PartialQueryCollector {
  preparable = false;
  retryable = false;
  private _parts: unknown[] = [];
  private _binds: unknown[] = [];

  append(str: string): this {
    this._parts.push(str);
    return this;
  }

  addBind(obj: unknown): this {
    this._binds.push(obj);
    this._parts.push(new Substitute());
    return this;
  }

  addBinds(binds: unknown[], procForBinds?: (v: unknown) => unknown): this {
    const mapped = procForBinds ? binds.map(procForBinds) : binds;
    this._binds.push(...mapped);
    for (let i = 0; i < binds.length; i++) {
      if (i > 0) this._parts.push(", ");
      this._parts.push(new Substitute());
    }
    return this;
  }

  get value(): [unknown[], unknown[]] {
    return [this._parts, this._binds];
  }
}

/**
 * Provides bind() for building relations with Substitute placeholders.
 * Mirrors: ActiveRecord::StatementCache::Params
 */
export class Params {
  bind(): Substitute {
    return new Substitute();
  }
}

/**
 * Maps Substitute positions in bound attributes to execution-time values.
 * Mirrors: ActiveRecord::StatementCache::BindMap
 */
export class BindMap {
  private _indexes: number[];
  private _boundAttributes: unknown[];

  constructor(boundAttributes: unknown[]) {
    this._boundAttributes = boundAttributes;
    this._indexes = [];
    for (let i = 0; i < boundAttributes.length; i++) {
      const attr = boundAttributes[i];
      if (attr instanceof Substitute) {
        this._indexes.push(i);
      } else if (
        attr &&
        typeof attr === "object" &&
        "value" in attr &&
        (attr as any).value instanceof Substitute
      ) {
        this._indexes.push(i);
      }
    }
  }

  bind(values: unknown[]): unknown[] {
    const bas = [...this._boundAttributes];
    for (let i = 0; i < this._indexes.length; i++) {
      const offset = this._indexes[i];
      const attr = bas[offset];
      if (attr && typeof attr === "object" && "withCastValue" in attr) {
        bas[offset] = (attr as { withCastValue(v: unknown): unknown }).withCastValue(values[i]);
      } else {
        bas[offset] = values[i];
      }
    }
    return bas;
  }
}

/**
 * Caches a compiled statement for repeated execution with different values.
 * Mirrors: ActiveRecord::StatementCache
 */
export class StatementCache {
  private _queryBuilder: Query | PartialQuery;
  private _bindMap: BindMap;
  private _model: typeof Base;

  constructor(queryBuilder: Query | PartialQuery, bindMap: BindMap, model: typeof Base) {
    this._queryBuilder = queryBuilder;
    this._bindMap = bindMap;
    this._model = model;
  }

  static query(sql: string, options: { retryable?: boolean } = {}): Query {
    return new Query(sql, options);
  }

  static partialQuery(values: unknown[], options: { retryable?: boolean } = {}): PartialQuery {
    return new PartialQuery(values, options);
  }

  static partialQueryCollector(): PartialQueryCollector {
    return new PartialQueryCollector();
  }

  /**
   * Create a cached statement from a relation-building block.
   * Mirrors: ActiveRecord::StatementCache.create
   */
  static create(
    connection: {
      cacheableQuery?(klass: unknown, arel: unknown): [unknown, unknown[]];
      preparedStatements?: boolean;
    },
    callable: (params: Params) => { arel: { toSql(): string }; model: typeof Base },
  ): StatementCache {
    const relation = callable(new Params());
    const arel = relation.arel;

    let queryBuilder: Query | PartialQuery;
    let binds: unknown[];

    if (connection.cacheableQuery) {
      [queryBuilder, binds] = connection.cacheableQuery(StatementCache, arel) as [
        Query | PartialQuery,
        unknown[],
      ];
    } else {
      const sql = arel.toSql();
      queryBuilder = new Query(sql);
      binds = [];
    }

    const bindMap = new BindMap(binds);
    return new StatementCache(queryBuilder, bindMap, relation.model);
  }

  /**
   * Execute the cached statement with the given bind values.
   * Mirrors: ActiveRecord::StatementCache#execute
   */
  async execute(
    params: unknown[],
    connection: { quote?(value: unknown): string },
  ): Promise<InstanceType<typeof Base>[]> {
    const bindValues = this._bindMap.bind(params);
    const sql = this._queryBuilder.sqlFor(bindValues, connection);
    return this._model.findBySql(sql, bindValues);
  }

  /**
   * Check if a value type is unsupported for statement caching.
   * Mirrors: ActiveRecord::StatementCache.unsupported_value?
   */
  static unsupportedValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return true;
    if (value && typeof value === "object") {
      const name = (value as any).constructor?.name;
      if (name === "Range" || name === "Relation") return true;
      if (value instanceof Map || value instanceof Set) return true;
    }
    return false;
  }
}

function quoteValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}
