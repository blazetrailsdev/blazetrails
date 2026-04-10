import { QueryCacheStore } from "../../query-cache.js";

const DEFAULT_SIZE = 100;

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache::Store
 */
export class Store extends QueryCacheStore {
  isDirties(): boolean {
    return this.dirties;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache::QueryCacheRegistry
 */
export class QueryCacheRegistry {
  private _caches = new Map<string, Store>();

  computeIfAbsent(key: string, create: () => Store): Store {
    let cache = this._caches.get(key);
    if (!cache) {
      cache = create();
      this._caches.set(key, cache);
    }
    return cache;
  }

  getCache(key: string): Store {
    return this.computeIfAbsent(key, () => new Store());
  }

  clear(): void {
    for (const cache of this._caches.values()) {
      cache.clear();
    }
    this._caches.clear();
  }
}

/**
 * Host interface for QueryCache connection-level mixin methods.
 */
export interface QueryCacheHost {
  pool?: {
    enableQueryCache?<T>(fn: () => T | Promise<T>): T | Promise<T>;
    disableQueryCache?<T>(fn: () => T | Promise<T>, opts?: { dirties?: boolean }): T | Promise<T>;
    enableQueryCacheBang?(): void;
    disableQueryCacheBang?(): void;
    clearQueryCache?(): void;
    queryCache?: Store;
    queryCacheEnabled?: boolean;
    dirtiesQueryCache?: boolean;
  };
  queryCache: Store | null;
  selectAll?(sql: string, name?: string | null, binds?: unknown[]): Promise<unknown>;
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache::ConnectionPoolConfiguration
 *
 * Mixin for connection pools that manages the per-thread query cache.
 */
export class ConnectionPoolConfiguration {
  private _threadQueryCaches = new QueryCacheRegistry();
  private _queryCacheMaxSize: number | null;

  constructor(queryCacheConfig?: number | false | null) {
    if (queryCacheConfig === 0 || queryCacheConfig === false) {
      this._queryCacheMaxSize = null;
    } else if (typeof queryCacheConfig === "number") {
      this._queryCacheMaxSize = queryCacheConfig;
    } else {
      this._queryCacheMaxSize = DEFAULT_SIZE;
    }
  }

  checkoutAndVerify(connection: QueryCacheHost): QueryCacheHost {
    if (!connection.queryCache) {
      connection.queryCache = this.queryCache;
    }
    return connection;
  }

  async disableQueryCache<T>(
    fn: () => T | Promise<T>,
    options: { dirties?: boolean } = {},
  ): Promise<T> {
    const { dirties = true } = options;
    const qc = this.queryCache;
    const oldEnabled = qc.enabled;
    const oldDirties = qc.dirties;
    qc.enabled = false;
    qc.dirties = dirties;
    try {
      return await fn();
    } finally {
      qc.enabled = oldEnabled;
      qc.dirties = oldDirties;
    }
  }

  async enableQueryCache<T>(fn: () => T | Promise<T>): Promise<T> {
    const qc = this.queryCache;
    const oldEnabled = qc.enabled;
    const oldDirties = qc.dirties;
    qc.enabled = true;
    qc.dirties = true;
    try {
      return await fn();
    } finally {
      qc.enabled = oldEnabled;
      qc.dirties = oldDirties;
    }
  }

  enableQueryCacheBang(): void {
    const qc = this.queryCache;
    qc.enabled = true;
    qc.dirties = true;
  }

  disableQueryCacheBang(): void {
    const qc = this.queryCache;
    qc.enabled = false;
    qc.dirties = true;
  }

  get queryCacheEnabled(): boolean {
    return this.queryCache.enabled;
  }

  get dirtiesQueryCache(): boolean {
    return this.queryCache.dirties;
  }

  clearQueryCache(): void {
    this.queryCache.clear();
  }

  get queryCache(): Store {
    return this._threadQueryCaches.computeIfAbsent("default", () => {
      return new Store(this._queryCacheMaxSize ?? undefined);
    });
  }
}

// ---------------------------------------------------------------------------
// Connection-level mixin functions
// Mirrors: ActiveRecord::ConnectionAdapters::QueryCache (module mixed into connection)
// ---------------------------------------------------------------------------

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache#query_cache (attr_accessor)
 */
export function queryCache(this: QueryCacheHost): Store | null {
  return this.queryCache;
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache#query_cache_enabled
 */
export function queryCacheEnabled(this: QueryCacheHost): boolean {
  return this.queryCache?.enabled ?? false;
}

/**
 * Enable the query cache within the block.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache#cache
 */
export async function cache<T>(this: QueryCacheHost, fn: () => T | Promise<T>): Promise<T> {
  if (this.pool?.enableQueryCache) {
    return this.pool.enableQueryCache(fn) as Promise<T>;
  }
  const qc = this.queryCache;
  if (!qc) return fn() as Promise<T>;
  const oldEnabled = qc.enabled;
  const oldDirties = qc.dirties;
  qc.enabled = true;
  qc.dirties = true;
  try {
    return await fn();
  } finally {
    qc.enabled = oldEnabled;
    qc.dirties = oldDirties;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache#enable_query_cache!
 */
export function enableQueryCacheBang(this: QueryCacheHost): void {
  if (this.pool?.enableQueryCacheBang) {
    this.pool.enableQueryCacheBang();
    return;
  }
  const qc = this.queryCache;
  if (qc) {
    qc.enabled = true;
    qc.dirties = true;
  }
}

/**
 * Disable the query cache within the block.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache#uncached
 */
export async function uncached<T>(
  this: QueryCacheHost,
  fn: () => T | Promise<T>,
  options: { dirties?: boolean } = {},
): Promise<T> {
  const { dirties = true } = options;
  if (this.pool?.disableQueryCache) {
    return this.pool.disableQueryCache(fn, { dirties }) as Promise<T>;
  }
  const qc = this.queryCache;
  if (!qc) return fn() as Promise<T>;
  const oldEnabled = qc.enabled;
  const oldDirties = qc.dirties;
  qc.enabled = false;
  qc.dirties = dirties;
  try {
    return await fn();
  } finally {
    qc.enabled = oldEnabled;
    qc.dirties = oldDirties;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache#disable_query_cache!
 */
export function disableQueryCacheBang(this: QueryCacheHost): void {
  if (this.pool?.disableQueryCacheBang) {
    this.pool.disableQueryCacheBang();
    return;
  }
  const qc = this.queryCache;
  if (qc) {
    qc.enabled = false;
    qc.dirties = true;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache#clear_query_cache
 */
export function clearQueryCache(this: QueryCacheHost): void {
  if (this.pool?.clearQueryCache) {
    this.pool.clearQueryCache();
    return;
  }
  this.queryCache?.clear();
}

/**
 * Cached override for selectAll. When the query cache is enabled and the
 * query is not locked (FOR UPDATE), results are served from cache.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache#select_all
 */
export async function selectAll(
  this: QueryCacheHost & { selectAll?: (...args: unknown[]) => Promise<unknown> },
  sql: string,
  name?: string | null,
  binds?: unknown[],
): Promise<unknown> {
  const qc = this.queryCache;
  if (qc?.enabled) {
    if (/\bFOR\s+(UPDATE|SHARE|NO\s+KEY\s+UPDATE|KEY\s+SHARE)\b/i.test(sql)) {
      return this.selectAll!(sql, name, binds);
    }

    const key = binds && binds.length > 0 ? JSON.stringify([sql, binds]) : sql;
    return qc.computeIfAbsent(key, async () => {
      return (await this.selectAll!(sql, name, binds)) as Record<string, unknown>[];
    });
  }
  return this.selectAll!(sql, name, binds);
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::QueryCache.dirties_query_cache
 */
export function dirtiesQueryCache(_base: unknown, ..._methodNames: string[]): void {
  // In Rails this monkey-patches methods to clear query caches before execution.
  // In TS, cache invalidation is handled by the QueryCacheAdapter wrapper and
  // materializeTransactions wiring. This function exists for API parity.
}
