/**
 * SQLite driver adapter — generic "open a SQLite handle and run statements"
 * abstraction. Mirrors the `fs-adapter.ts` registry shape: drivers register
 * themselves on import, and consumers resolve an instance via `getSqlite()`.
 *
 * The driver is opaque to query construction: bytes-in (SQL string + binds),
 * rows-out (raw row values + column metadata). Type coercion and Date encoding
 * stay in callers (e.g. `Sqlite3Adapter`) so PG/MySQL/SQLite share one path.
 */

/** Anything a sqlite driver must accept as a bound parameter. */
export type SqliteBindValue = null | string | number | bigint | boolean | Uint8Array | Date;

/** Positional or named binds; statement methods accept either form. */
export type SqliteBinds = readonly SqliteBindValue[] | { readonly [name: string]: SqliteBindValue };

export interface ColumnInfo {
  name: string;
  column: string | null;
  table: string | null;
  database: string | null;
  type: string | null;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface SqliteStatement {
  /** INSERT/UPDATE/DELETE/DDL. */
  run(binds?: SqliteBinds): RunResult | Promise<RunResult>;
  /** First row, or undefined if none. */
  get(binds?: SqliteBinds): unknown | Promise<unknown>;
  /** All rows. Drivers MAY stream internally but MUST return a fully-realized array. */
  all(binds?: SqliteBinds): unknown[] | Promise<unknown[]>;
  /**
   * Row-at-a-time iteration. Sync drivers return Iterable; async drivers return
   * AsyncIterable. AR's batch path uses this for large result sets.
   */
  iterate(binds?: SqliteBinds): Iterable<unknown> | AsyncIterable<unknown>;
  columns(): ColumnInfo[];
  /** Toggle bigint return for integer columns. Default: false. */
  setReadBigInts(on: boolean): void;
  /** True when the statement returns rows (SELECT/PRAGMA that yields rows). */
  readonly reader: boolean;
  /** Optional — drivers without explicit finalization MAY omit. */
  finalize?(): void | Promise<void>;
}

/** An open SQLite handle. */
export interface SqliteConnection {
  prepare(sql: string): SqliteStatement | Promise<SqliteStatement>;
  exec(sql: string): void | Promise<void>;
  pragma(source: string, opts?: { simple?: boolean }): unknown | Promise<unknown>;
  /** Idempotent. After close(), all calls reject / throw. */
  close(): void | Promise<void>;
  /** True between successful open() and close(). */
  isOpen(): boolean;
  /** Driver-specific escape hatch (e.g. better-sqlite3 `Database` instance). */
  readonly raw: unknown;
}

export interface SqliteOpenConfig {
  /** File path or special URI (`:memory:`, `file::memory:?cache=shared`). */
  database: string;
  /** Open in read-only mode. Default false. */
  readOnly?: boolean;
  /** SQLITE_OPEN_NOMUTEX equivalent — opt-in for single-threaded use. */
  noMutex?: boolean;
  /** busy_timeout ms for SQLITE_BUSY contention. Default 5000. */
  timeout?: number;
  /** Driver-specific options pass-through. AR core never inspects this. */
  driverOptions?: Record<string, unknown>;
}

export interface SqliteDriverCapabilities {
  readonly inProcessSync: boolean;
  readonly streaming: boolean;
  readonly loadExtension: boolean;
  readonly concurrentStatements: boolean;
  readonly foreignKeysOnByDefault: boolean;
  readonly immediateTransactions: boolean;
}

export interface SqliteDriver {
  readonly name: string;
  readonly capabilities: SqliteDriverCapabilities;
  open(config: SqliteOpenConfig): Promise<SqliteConnection>;
  /**
   * Sync open for `inProcessSync` drivers. The async-aware adapter (PR 3)
   * lifts everything onto `open()`; this hook bridges the existing sync
   * `connect()` path until that lands.
   * @internal
   */
  openSync?(config: SqliteOpenConfig): SqliteConnection;
  /**
   * Pre-flight existence check. Optional — drivers that can't statelessly
   * answer (network-backed) leave undefined and callers fall back to
   * attempt-and-catch.
   */
  databaseExists?(config: SqliteOpenConfig): boolean | Promise<boolean>;
}

// Stash the registry on globalThis under a Symbol so that module duplication
// (vi.resetModules in tests, or pkg-manager hoisting splits in apps) doesn't
// drop driver registrations. Drivers self-register on import; without this,
// the second module instance starts empty and breaks any consumer holding the
// first instance's getSqlite reference (and vice versa).
const REGISTRY_KEY = Symbol.for("@blazetrails/activesupport/sqlite-adapter/registry");
type GlobalWithRegistry = typeof globalThis & {
  [REGISTRY_KEY]?: Map<string, SqliteDriver>;
};
const registry: Map<string, SqliteDriver> = ((globalThis as GlobalWithRegistry)[REGISTRY_KEY] ??=
  new Map());

export function registerSqliteDriver(driver: SqliteDriver): void {
  if (registry.has(driver.name)) {
    console.warn(
      `SQLite driver "${driver.name}" is already registered; overwriting prior registration.`,
    );
  }
  registry.set(driver.name, driver);
}

export function clearSqliteDrivers(): void {
  registry.clear();
}

function resolveName(name?: string): string {
  if (name) return name;
  const env =
    typeof globalThis.process !== "undefined" && globalThis.process.versions?.node
      ? globalThis.process.env?.AR_SQLITE_DRIVER
      : undefined;
  if (env) return env;
  if (registry.size === 1) return registry.keys().next().value as string;
  if (registry.size === 0) {
    throw new Error(
      "No SQLite driver registered. Import `@blazetrails/activesupport/sqlite/better-sqlite3` " +
        "or register a custom driver via `registerSqliteDriver()`.",
    );
  }
  throw new Error(
    `Multiple SQLite drivers registered (${[...registry.keys()].join(", ")}). ` +
      "Pass a name to `getSqlite(name)` or set AR_SQLITE_DRIVER.",
  );
}

export function getSqlite(name?: string): SqliteDriver {
  const resolved = resolveName(name);
  const driver = registry.get(resolved);
  if (!driver) {
    throw new Error(
      `SQLite driver "${resolved}" is not registered. Registered drivers: [${[...registry.keys()].join(", ") || "none"}].`,
    );
  }
  return driver;
}

export async function getSqliteAsync(name?: string): Promise<SqliteDriver> {
  return getSqlite(name);
}
