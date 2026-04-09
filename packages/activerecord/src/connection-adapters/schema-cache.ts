/**
 * Schema cache — caches database schema information to avoid repeated
 * introspection queries.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SchemaCache
 */

import { getFs, getPath } from "@blazetrails/activesupport";
import type { Column } from "./column.js";

// ---------------------------------------------------------------------------
// SchemaCache
// ---------------------------------------------------------------------------

export class SchemaCache {
  private _columns = new Map<string, Column[]>();
  private _columnsHash = new Map<string, Map<string, Column>>();
  private _primaryKeys = new Map<string, string | null>();
  private _dataSourceExists = new Map<string, boolean>();
  private _indexes = new Map<string, unknown[]>();
  private _version: string | null = null;

  static _loadFrom(filename: string): SchemaCache | null {
    const fs = getFs();
    if (!fs.existsSync(filename)) return null;
    const data = SchemaCache.read(filename, (content) => content);
    if (typeof data !== "string") return null;
    try {
      const parsed = JSON.parse(data);
      const cache = new SchemaCache();
      cache.initWith(parsed);
      return cache;
    } catch {
      return null;
    }
  }

  static read<T>(filename: string, callback: (data: string) => T): T {
    const fs = getFs();
    const content = fs.readFileSync(filename, "utf-8");
    return callback(content);
  }

  initializeDup(): SchemaCache {
    const dup = new SchemaCache();
    dup._columns = new Map(this._columns);
    dup._columnsHash = new Map(this._columnsHash);
    dup._primaryKeys = new Map(this._primaryKeys);
    dup._dataSourceExists = new Map(this._dataSourceExists);
    dup._indexes = new Map(this._indexes);
    dup._version = this._version;
    return dup;
  }

  encodeWith(coder: Record<string, unknown>): void {
    const byKey = (a: [string, unknown], b: [string, unknown]) => a[0].localeCompare(b[0]);
    coder["columns"] = Object.fromEntries([...this._columns].sort(byKey));
    coder["primary_keys"] = Object.fromEntries([...this._primaryKeys].sort(byKey));
    coder["data_sources"] = Object.fromEntries([...this._dataSourceExists].sort(byKey));
    coder["indexes"] = Object.fromEntries([...this._indexes].sort(byKey));
    coder["version"] = this._version;
  }

  initWith(coder: Record<string, unknown>): void {
    if (coder["columns"] instanceof Map) {
      this._columns = coder["columns"] as Map<string, Column[]>;
    } else if (coder["columns"] && typeof coder["columns"] === "object") {
      this._columns = new Map(Object.entries(coder["columns"] as Record<string, Column[]>));
    }

    if (coder["primary_keys"] instanceof Map) {
      this._primaryKeys = coder["primary_keys"] as Map<string, string | null>;
    } else if (coder["primary_keys"] && typeof coder["primary_keys"] === "object") {
      this._primaryKeys = new Map(
        Object.entries(coder["primary_keys"] as Record<string, string | null>),
      );
    }

    if (coder["data_sources"] instanceof Map) {
      this._dataSourceExists = coder["data_sources"] as Map<string, boolean>;
    } else if (coder["data_sources"] && typeof coder["data_sources"] === "object") {
      this._dataSourceExists = new Map(
        Object.entries(coder["data_sources"] as Record<string, boolean>),
      );
    }

    if (coder["indexes"] instanceof Map) {
      this._indexes = coder["indexes"] as Map<string, unknown[]>;
    } else if (coder["indexes"] && typeof coder["indexes"] === "object") {
      this._indexes = new Map(Object.entries(coder["indexes"] as Record<string, unknown[]>));
    }

    this._version = (coder["version"] as string) ?? null;

    // Derive columnsHash from columns
    this._columnsHash.clear();
    for (const [table, cols] of this._columns) {
      const hash = new Map<string, Column>();
      for (const col of cols) {
        hash.set(col.name, col);
      }
      this._columnsHash.set(table, hash);
    }
  }

  isCached(tableName: string): boolean {
    return this._columns.has(tableName);
  }

  primaryKeys(pool: unknown, tableName?: string): string | null | undefined {
    if (tableName === undefined) {
      tableName = pool as string;
      pool = null;
    }
    if (this._primaryKeys.has(tableName)) {
      return this._primaryKeys.get(tableName);
    }
    const connection = resolveConnection(pool);
    if (connection && this.dataSourceExists(pool, tableName)) {
      const pk = connection.primaryKey?.(tableName) ?? null;
      this._primaryKeys.set(tableName, pk);
      return pk;
    }
    return undefined;
  }

  dataSourceExists(pool: unknown, name?: string): boolean | undefined {
    if (name === undefined) {
      name = pool as string;
      pool = null;
    }
    if (this._dataSourceExists.has(name)) {
      return this._dataSourceExists.get(name);
    }
    const connection = resolveConnection(pool);
    if (connection && typeof connection.dataSourceExists === "function") {
      const exists = connection.dataSourceExists(name);
      this._dataSourceExists.set(name, exists);
      return exists;
    }
    return undefined;
  }

  add(pool: unknown, tableName?: string): void {
    if (tableName === undefined) {
      tableName = pool as string;
      pool = null;
    }
    if (this.dataSourceExists(pool, tableName)) {
      this.primaryKeys(pool, tableName);
      this.columns(pool, tableName);
      this.columnsHash(pool, tableName);
      this.indexes(pool, tableName);
    }
  }

  columns(pool: unknown, tableName?: string): Column[] | undefined {
    if (tableName === undefined) {
      tableName = pool as string;
      pool = null;
    }
    if (this._columns.has(tableName)) {
      return this._columns.get(tableName);
    }
    const connection = resolveConnection(pool);
    if (connection && typeof connection.columns === "function") {
      const cols = connection.columns(tableName);
      this.setColumns(tableName, cols);
      return cols;
    }
    return undefined;
  }

  columnsHash(pool: unknown, tableName?: string): Map<string, Column> | undefined {
    if (tableName === undefined) {
      tableName = pool as string;
      pool = null;
    }
    if (this._columnsHash.has(tableName)) {
      return this._columnsHash.get(tableName);
    }
    const cols = this.columns(pool, tableName);
    if (cols) {
      return this._columnsHash.get(tableName);
    }
    return undefined;
  }

  isColumnsHashCached(_pool: unknown, tableName?: string): boolean {
    if (tableName === undefined) {
      tableName = _pool as string;
    }
    return this._columnsHash.has(tableName);
  }

  indexes(pool: unknown, tableName?: string): unknown[] {
    if (tableName === undefined) {
      tableName = pool as string;
      pool = null;
    }
    if (this._indexes.has(tableName)) {
      return this._indexes.get(tableName)!;
    }
    const connection = resolveConnection(pool);
    if (connection && typeof connection.indexes === "function") {
      if (this.dataSourceExists(pool, tableName)) {
        const idx = connection.indexes(tableName);
        this._indexes.set(tableName, idx);
        return idx;
      }
    }
    return [];
  }

  version(pool?: unknown): string | null {
    if (this._version !== null) return this._version;
    const connection = resolveConnection(pool);
    if (connection && typeof connection.schemaVersion === "function") {
      this._version = connection.schemaVersion();
    }
    return this._version;
  }

  get schemaVersion(): string | null {
    return this._version;
  }

  get size(): number {
    return (
      this._columns.size +
      this._columnsHash.size +
      this._primaryKeys.size +
      this._dataSourceExists.size
    );
  }

  clearDataSourceCacheBang(_pool: unknown, name: string): void {
    this._columns.delete(name);
    this._columnsHash.delete(name);
    this._primaryKeys.delete(name);
    this._dataSourceExists.delete(name);
    this._indexes.delete(name);
  }

  setColumns(tableName: string, cols: Column[]): void {
    this._columns.set(tableName, cols);
    const hash = new Map<string, Column>();
    for (const col of cols) {
      hash.set(col.name, col);
    }
    this._columnsHash.set(tableName, hash);
    this._dataSourceExists.set(tableName, true);
  }

  setPrimaryKeys(tableName: string, pk: string | null): void {
    this._primaryKeys.set(tableName, pk);
  }

  setDataSourceExists(tableName: string, exists: boolean): void {
    this._dataSourceExists.set(tableName, exists);
  }

  addAll(pool: unknown): void {
    const connection = resolveConnection(pool);
    if (connection && typeof connection.dataSources === "function") {
      const tables: string[] = connection.dataSources();
      for (const table of tables) {
        this.add(pool, table);
      }
    }
    this.version(pool);
  }

  dumpTo(filename: string): void {
    const fs = getFs();
    const path = getPath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const coder: Record<string, unknown> = {};
    this.encodeWith(coder);
    fs.writeFileSync(filename, JSON.stringify(coder, null, 2), "utf-8");
  }

  marshalDump(): unknown[] {
    return [
      this._version,
      Object.fromEntries(this._columns),
      {},
      Object.fromEntries(this._primaryKeys),
      Object.fromEntries(this._dataSourceExists),
      Object.fromEntries(this._indexes),
    ];
  }

  marshalLoad(array: unknown[]): void {
    const [version, columns, _columnsHash, primaryKeys, dataSources, indexes] = array;
    this._version = (version as string) ?? null;

    this._columns = new Map(Object.entries((columns as Record<string, Column[]>) ?? {}));
    this._primaryKeys = new Map(
      Object.entries((primaryKeys as Record<string, string | null>) ?? {}),
    );
    this._dataSourceExists = new Map(
      Object.entries((dataSources as Record<string, boolean>) ?? {}),
    );
    this._indexes = new Map(Object.entries((indexes as Record<string, unknown[]>) ?? {}));

    // Derive columnsHash
    this._columnsHash.clear();
    for (const [table, cols] of this._columns) {
      const hash = new Map<string, Column>();
      for (const col of cols) {
        hash.set(col.name, col);
      }
      this._columnsHash.set(table, hash);
    }
  }

  clear(): void {
    this._columns.clear();
    this._columnsHash.clear();
    this._primaryKeys.clear();
    this._dataSourceExists.clear();
    this._indexes.clear();
    this._version = null;
  }
}

// ---------------------------------------------------------------------------
// Helper: extract connection from pool
// ---------------------------------------------------------------------------

/**
 * Resolve a connection from a pool-like object.
 *
 * If pool has withConnection, it's a real pool — but we can't safely extract
 * the connection outside the callback scope. For synchronous cache-miss paths,
 * we check if pool itself is a connection (has columns/primaryKey methods).
 *
 * For proper pool support, callers should use pool.withConnection() directly.
 */
function resolveConnection(pool: unknown): any {
  if (!pool) return null;
  // Pool might itself be a connection (e.g., FakePool-wrapped or direct adapter)
  if (typeof (pool as any).columns === "function") {
    return pool;
  }
  // Try to get connection from pool synchronously
  if (typeof (pool as any).withConnection === "function") {
    let conn: any = null;
    try {
      (pool as any).withConnection((c: any) => {
        conn = c;
      });
    } catch {
      // withConnection may be async-only
    }
    return conn;
  }
  return null;
}

// ---------------------------------------------------------------------------
// SchemaReflection
// ---------------------------------------------------------------------------

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::SchemaReflection
 *
 * Wraps a SchemaCache. Introspection methods that consult the cache
 * and fall back to the database will be added as they are needed.
 */
export class SchemaReflection {
  static useSchemaCache = true;
  static checkSchemaCacheDumpVersion = true;

  private _cache: SchemaCache | null;
  private _cachePath: string | null;

  constructor(cachePath?: string | null, cache?: SchemaCache) {
    this._cache = cache ?? null;
    this._cachePath = cachePath ?? null;
  }

  clearBang(): void {
    this._cache = new SchemaCache();
  }

  loadBang(pool: unknown): this {
    this.cache(pool);
    return this;
  }

  primaryKeys(pool: unknown, tableName: string): string | null | undefined {
    return this.cache(pool).primaryKeys(pool, tableName);
  }

  dataSourceExists(pool: unknown, name: string): boolean | undefined {
    return this.cache(pool).dataSourceExists(pool, name);
  }

  add(pool: unknown, name: string): void {
    this.cache(pool).add(pool, name);
  }

  dataSources(pool: unknown, name: string): boolean | undefined {
    return this.cache(pool).dataSourceExists(pool, name);
  }

  columns(pool: unknown, tableName: string): Column[] | undefined {
    return this.cache(pool).columns(pool, tableName);
  }

  columnsHash(pool: unknown, tableName: string): Map<string, Column> | undefined {
    return this.cache(pool).columnsHash(pool, tableName);
  }

  isColumnsHashCached(pool: unknown, tableName: string): boolean {
    return this.cache(pool).isColumnsHashCached(pool, tableName);
  }

  indexes(pool: unknown, tableName: string): unknown[] {
    return this.cache(pool).indexes(pool, tableName);
  }

  version(pool: unknown): string | null {
    return this.cache(pool).version(pool);
  }

  size(pool: unknown): number {
    return this.cache(pool).size;
  }

  clearDataSourceCacheBang(pool: unknown, name: string): void {
    if (!this._cache) return;
    this.cache(pool).clearDataSourceCacheBang(pool, name);
  }

  isCached(tableName: string): boolean {
    return this._cache?.isCached(tableName) ?? false;
  }

  dumpTo(pool: unknown, filename: string): void {
    const freshCache = new SchemaCache();
    freshCache.addAll(pool);
    freshCache.dumpTo(filename);
    this._cache = freshCache;
  }

  private cache(pool: unknown): SchemaCache {
    if (!this._cache) {
      this._cache = new SchemaCache();
    }
    return this._cache;
  }
}

// ---------------------------------------------------------------------------
// BoundSchemaReflection
// ---------------------------------------------------------------------------

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::BoundSchemaReflection
 *
 * Schema reflection bound to a specific connection pool.
 */
export class BoundSchemaReflection {
  private _schemaReflection: SchemaReflection;
  private _pool: unknown;

  static forLoneConnection(
    schemaReflection: SchemaReflection,
    connection: unknown,
  ): BoundSchemaReflection {
    return new BoundSchemaReflection(schemaReflection, new FakePool(connection));
  }

  constructor(schemaReflection: SchemaReflection, pool: unknown) {
    this._schemaReflection = schemaReflection;
    this._pool = pool;
  }

  clearBang(): void {
    this._schemaReflection.clearBang();
  }

  loadBang(): this {
    this._schemaReflection.loadBang(this._pool);
    return this;
  }

  isCached(tableName: string): boolean {
    return this._schemaReflection.isCached(tableName);
  }

  primaryKeys(tableName: string): string | null | undefined {
    return this._schemaReflection.primaryKeys(this._pool, tableName);
  }

  dataSourceExists(name: string): boolean | undefined {
    return this._schemaReflection.dataSourceExists(this._pool, name);
  }

  add(name: string): void {
    this._schemaReflection.add(this._pool, name);
  }

  dataSources(name: string): boolean | undefined {
    return this._schemaReflection.dataSources(this._pool, name);
  }

  columns(tableName: string): Column[] | undefined {
    return this._schemaReflection.columns(this._pool, tableName);
  }

  columnsHash(tableName: string): Map<string, Column> | undefined {
    return this._schemaReflection.columnsHash(this._pool, tableName);
  }

  isColumnsHashCached(tableName: string): boolean {
    return this._schemaReflection.isColumnsHashCached(this._pool, tableName);
  }

  indexes(tableName: string): unknown[] {
    return this._schemaReflection.indexes(this._pool, tableName);
  }

  version(): string | null {
    return this._schemaReflection.version(this._pool);
  }

  size(): number {
    return this._schemaReflection.size(this._pool);
  }

  clearDataSourceCacheBang(name: string): void {
    this._schemaReflection.clearDataSourceCacheBang(this._pool, name);
  }

  dumpTo(filename: string): void {
    this._schemaReflection.dumpTo(this._pool, filename);
  }
}

// ---------------------------------------------------------------------------
// FakePool
// ---------------------------------------------------------------------------

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::BoundSchemaReflection::FakePool
 */
export class FakePool {
  private _connection: unknown;

  constructor(connection: unknown) {
    this._connection = connection;
  }

  withConnection<T>(callback: (conn: unknown) => T): T {
    return callback(this._connection);
  }
}
