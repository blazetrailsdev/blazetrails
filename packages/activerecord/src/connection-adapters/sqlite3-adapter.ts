import Database from "better-sqlite3";
import type { DatabaseAdapter } from "../adapter.js";
import { AbstractAdapter, Version } from "./abstract-adapter.js";
import { StatementPool as GenericStatementPool } from "./statement-pool.js";
import {
  ReadOnlyError,
  StatementInvalid,
  RecordNotUnique,
  InvalidForeignKey,
  NotNullViolation,
  ValueTooLong,
  NoDatabaseError,
  DatabaseConnectionError,
} from "../errors.js";
import { TypeMap } from "../type/type-map.js";
import { Date as DateType } from "../type/date.js";
import { DateTime as DateTimeType } from "../type/date-time.js";
import { Time as TimeType } from "../type/time.js";
import { Text as TextType } from "../type/text.js";
import { Json as JsonType } from "../type/json.js";
import { DecimalWithoutScale } from "../type/decimal-without-scale.js";
import {
  StringType,
  IntegerType,
  FloatType,
  BooleanType,
  BinaryType,
  BigIntegerType,
  DecimalType,
} from "@blazetrails/activemodel";
import { getFs } from "@blazetrails/activesupport";

/**
 * SQLite adapter — connects ActiveRecord to a real SQLite database.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3Adapter
 */
export class SQLite3Adapter extends AbstractAdapter implements DatabaseAdapter {
  override get adapterName(): string {
    return "SQLite";
  }

  private db: Database.Database;
  private _inTransaction = false;
  private _savepointCounter = 0;
  private _readonly: boolean;
  private _preventWrites = false;
  private _nativeTypeMap: TypeMap;
  private _memoryDatabase: boolean;
  private _filename: string;

  constructor(filename: string | ":memory:" = ":memory:", options?: { readonly?: boolean }) {
    super();
    this._filename = filename;
    this._memoryDatabase = filename === ":memory:";
    this._readonly = options?.readonly ?? false;
    try {
      this.db = new Database(filename, { readonly: this._readonly });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new DatabaseConnectionError(`Unable to open database '${filename}': ${msg}`, {
        cause: e,
      });
    }
    if (!this._readonly) {
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
    }
    this._nativeTypeMap = SQLite3Adapter._buildTypeMap();
  }

  /**
   * Execute a SELECT query and return rows.
   */
  async execute(sql: string, binds: unknown[] = []): Promise<Record<string, unknown>[]> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...binds) as Record<string, unknown>[];
    } catch (e) {
      throw this._translateException(e, sql, binds);
    }
  }

  /**
   * Get or set a PRAGMA value.
   *
   * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3Adapter#pragma
   */
  pragma(name: string): unknown {
    return this.db.pragma(name);
  }

  /**
   * Prevent or allow write operations.
   *
   * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3Adapter#preventing_writes?
   */
  get preventingWrites(): boolean {
    return this._preventWrites;
  }

  /**
   * Execute a block with writes prevented.
   */
  async withPreventedWrites<R>(fn: () => R | Promise<R>): Promise<R> {
    this._preventWrites = true;
    try {
      return await fn();
    } finally {
      this._preventWrites = false;
    }
  }

  /**
   * Execute an INSERT/UPDATE/DELETE and return affected rows or insert ID.
   */
  async executeMutation(sql: string, binds: unknown[] = []): Promise<number> {
    if (this._preventWrites) {
      throw new ReadOnlyError("Write query attempted while preventing writes");
    }
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...binds);

      // For INSERT, return the last inserted rowid
      if (sql.trimStart().toUpperCase().startsWith("INSERT")) {
        return Number(result.lastInsertRowid);
      }

      // For UPDATE/DELETE, return affected rows
      return result.changes;
    } catch (e) {
      throw this._translateException(e, sql, binds);
    }
  }

  /**
   * Begin a transaction.
   */
  async beginTransaction(): Promise<void> {
    this.db.exec("BEGIN");
    this._inTransaction = true;
  }

  /**
   * Commit the current transaction.
   */
  async commit(): Promise<void> {
    this.db.exec("COMMIT");
    this._inTransaction = false;
  }

  /**
   * Rollback the current transaction.
   */
  async rollback(): Promise<void> {
    this.db.exec("ROLLBACK");
    this._inTransaction = false;
  }

  /**
   * Create a savepoint (nested transaction).
   */
  async createSavepoint(name: string): Promise<void> {
    this.db.exec(`SAVEPOINT "${name}"`);
  }

  /**
   * Release a savepoint.
   */
  async releaseSavepoint(name: string): Promise<void> {
    this.db.exec(`RELEASE SAVEPOINT "${name}"`);
  }

  /**
   * Rollback to a savepoint.
   */
  async rollbackToSavepoint(name: string): Promise<void> {
    this.db.exec(`ROLLBACK TO SAVEPOINT "${name}"`);
  }

  /**
   * Return the query execution plan.
   */
  async explain(sql: string): Promise<string> {
    const rows = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Record<string, unknown>[];
    return rows.map((r) => `${r.id}|${r.parent}|${r.notused}|${r.detail}`).join("\n");
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Check if the database is open.
   */
  get isOpen(): boolean {
    return this.db.open;
  }

  /**
   * Check if we're in a transaction.
   */
  get inTransaction(): boolean {
    return this._inTransaction;
  }

  /**
   * Execute raw SQL (for DDL and other non-query statements).
   */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Get the underlying better-sqlite3 Database instance.
   * Escape hatch for advanced usage.
   */
  get raw(): Database.Database {
    return this.db;
  }

  /**
   * Resolve a SQL column type string to an ActiveRecord Type instance.
   *
   * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3Adapter#lookup_cast_type
   */
  lookupCastType(sqlType: string): import("@blazetrails/activemodel").Type {
    // Strip precision/scale metadata and normalize for lookup.
    // e.g. "DECIMAL(10, 0)" → "decimal", "VARCHAR(255)" → "varchar"
    const normalized = sqlType
      .toLowerCase()
      .replace(/\(.*\)/, "")
      .trim();
    return this._nativeTypeMap.lookup(normalized);
  }

  get nativeTypeMap(): TypeMap {
    return this._nativeTypeMap;
  }

  private static _buildTypeMap(): TypeMap {
    const map = new TypeMap();
    map.registerType("string", new StringType());
    map.registerType("text", new TextType());
    map.registerType("integer", new IntegerType());
    map.registerType("float", new FloatType());
    map.registerType("decimal", new DecimalType());
    map.registerType("boolean", new BooleanType());
    map.registerType("date", new DateType());
    map.registerType("datetime", new DateTimeType());
    map.registerType("time", new TimeType());
    map.registerType("blob", new BinaryType());
    map.registerType("binary", new BinaryType());
    map.registerType("json", new JsonType());
    map.registerType("bigint", new BigIntegerType());
    map.registerType("numeric", new DecimalWithoutScale());
    // SQLite type affinity — regex matches for flexible type names
    map.registerType(/int/i, undefined, (lookupKey) => {
      if (/bigint/i.test(lookupKey)) return new BigIntegerType();
      return new IntegerType();
    });
    map.registerType(/char|clob/i, undefined, () => new StringType());
    map.registerType(/blob/i, undefined, () => new BinaryType());
    map.registerType(/real|floa|doub/i, undefined, () => new FloatType());
    return map;
  }

  // --- Capability overrides (Rails: SQLite3Adapter returns true for these) ---

  override supportsDdlTransactions(): boolean {
    return true;
  }

  override supportsSavepoints(): boolean {
    return true;
  }

  override supportsTransactionIsolation(): boolean {
    return true;
  }

  override supportsPartialIndex(): boolean {
    return true;
  }

  supportsExpressionIndex(): boolean {
    return this.databaseVersion.gte("3.9.0");
  }

  override supportsForeignKeys(): boolean {
    return true;
  }

  override supportsCheckConstraints(): boolean {
    return true;
  }

  override supportsViews(): boolean {
    return true;
  }

  override supportsDatetimeWithPrecision(): boolean {
    return true;
  }

  override supportsJson(): boolean {
    return true;
  }

  override supportsCommonTableExpressions(): boolean {
    return this.databaseVersion.gte("3.8.3");
  }

  supportsInsertReturning(): boolean {
    return this.databaseVersion.gte("3.35.0");
  }

  supportsInsertOnConflict(): boolean {
    return this.databaseVersion.gte("3.24.0");
  }

  override supportsConcurrentConnections(): boolean {
    return !this._memoryDatabase;
  }

  override supportsVirtualColumns(): boolean {
    return this.databaseVersion.gte("3.31.0");
  }

  override supportsIndexSortOrder(): boolean {
    return true;
  }

  override supportsExplain(): boolean {
    return true;
  }

  override supportsLazyTransactions(): boolean {
    return true;
  }

  override supportsDeferrableConstraints(): boolean {
    return true;
  }

  isRequiresReloading(): boolean {
    return false;
  }

  // --- Connection lifecycle ---

  override isConnected(): boolean {
    return this.db.open;
  }

  isActive(): boolean {
    return this.db.open;
  }

  override disconnectBang(): void {
    super.disconnectBang();
    if (this.db.open) {
      this.db.close();
    }
  }

  // --- Database info ---

  get nativeDatabaseTypes(): Record<string, { name: string; limit?: number }> {
    return {
      primary_key: { name: "integer" },
      string: { name: "varchar", limit: 255 },
      text: { name: "text" },
      integer: { name: "integer" },
      float: { name: "float" },
      decimal: { name: "decimal" },
      datetime: { name: "datetime" },
      time: { name: "time" },
      date: { name: "date" },
      binary: { name: "blob" },
      blob: { name: "blob" },
      boolean: { name: "boolean" },
      json: { name: "json" },
    };
  }

  get encoding(): string {
    const result = this.db.pragma("encoding") as Array<{ encoding: string }>;
    return result[0]?.encoding ?? "UTF-8";
  }

  isSharedCache(): boolean {
    return this._filename.includes("cache=shared");
  }

  override getDatabaseVersion(): Version {
    const result = this.db.pragma("data_version");
    const sqliteVersion = (this.db.prepare("SELECT sqlite_version() AS v").get() as any)?.v;
    return new Version(sqliteVersion ?? "0.0.0");
  }

  override checkVersion(): void {
    if (this.databaseVersion.lt("3.8.0")) {
      throw new Error(
        `Your version of SQLite (${this.databaseVersion}) is too old. Active Record supports SQLite >= 3.8.0.`,
      );
    }
  }

  static isDatabaseExists(config: { database?: string }): boolean {
    if (!config.database || config.database === ":memory:") return true;
    try {
      return getFs().existsSync(config.database);
    } catch {
      return false;
    }
  }

  static newClient(config: { database?: string; readonly?: boolean }): SQLite3Adapter {
    return new SQLite3Adapter(config.database, { readonly: config.readonly });
  }

  static override dbconsole(config?: { database?: string }): void {
    const db = config?.database ?? ":memory:";
    console.log(`sqlite3 ${db}`);
  }

  // --- Schema operations ---

  async primaryKeys(tableName: string): Promise<string[]> {
    const rows = await this.execute(`PRAGMA table_info("${tableName}")`);
    return rows.filter((r) => r.pk).map((r) => String(r.name));
  }

  async removeIndex(
    tableName: string,
    columnOrOptions?: string | string[] | { name?: string; column?: string | string[] },
  ): Promise<void> {
    let indexName: string;
    if (typeof columnOrOptions === "string") {
      indexName = `index_${tableName}_on_${columnOrOptions}`;
    } else if (Array.isArray(columnOrOptions)) {
      indexName = `index_${tableName}_on_${columnOrOptions.join("_and_")}`;
    } else if (columnOrOptions?.name) {
      indexName = columnOrOptions.name;
    } else if (columnOrOptions?.column) {
      const cols = Array.isArray(columnOrOptions.column)
        ? columnOrOptions.column.join("_and_")
        : columnOrOptions.column;
      indexName = `index_${tableName}_on_${cols}`;
    } else {
      throw new Error("No index name or column specified");
    }
    await this.executeMutation(`DROP INDEX IF EXISTS "${indexName}"`);
  }

  async virtualTables(): Promise<string[]> {
    const rows = await this.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND sql LIKE '%VIRTUAL%'",
    );
    return rows.map((r) => String(r.name));
  }

  override async createVirtualTable(
    tableName: string,
    moduleName?: unknown,
    values?: unknown,
  ): Promise<void> {
    const mod = moduleName as string;
    const vals = values as string[];
    const cols = (vals ?? []).join(", ");
    await this.executeMutation(`CREATE VIRTUAL TABLE "${tableName}" USING ${mod}(${cols})`);
  }

  async dropVirtualTable(
    tableName: string,
    _moduleName?: string,
    _values?: string[],
  ): Promise<void> {
    await this.executeMutation(`DROP TABLE IF EXISTS "${tableName}"`);
  }

  async renameTable(tableName: string, newName: string): Promise<void> {
    await this.executeMutation(`ALTER TABLE "${tableName}" RENAME TO "${newName}"`);
  }

  async addColumn(
    tableName: string,
    columnName: string,
    type: string,
    _options?: Record<string, unknown>,
  ): Promise<void> {
    const sqlType = this.nativeDatabaseTypes[type]?.name ?? type.toUpperCase();
    await this.executeMutation(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${sqlType}`);
  }

  async removeColumn(tableName: string, columnName: string, _type?: string): Promise<void> {
    await this.executeMutation(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`);
  }

  async removeColumns(tableName: string, ...columnNames: string[]): Promise<void> {
    for (const col of columnNames) {
      await this.removeColumn(tableName, col);
    }
  }

  async changeColumnDefault(
    tableName: string,
    columnName: string,
    defaultOrChanges: unknown,
  ): Promise<void> {
    const newDefault =
      typeof defaultOrChanges === "object" && defaultOrChanges !== null
        ? (defaultOrChanges as any).to
        : defaultOrChanges;
    const quoted = newDefault === null ? "NULL" : `'${newDefault}'`;
    // SQLite doesn't support ALTER COLUMN SET DEFAULT directly.
    // This requires table rebuild via copy strategy.
    throw new StatementInvalid(
      `SQLite does not support ALTER TABLE ... ALTER COLUMN ... SET DEFAULT. ` +
        `Column: ${tableName}.${columnName}, Default: ${quoted}`,
      { sql: "", binds: [] },
    );
  }

  async changeColumnNull(
    tableName: string,
    columnName: string,
    _null: boolean,
    _default?: unknown,
  ): Promise<void> {
    throw new StatementInvalid(
      `SQLite does not support ALTER TABLE ... ALTER COLUMN ... SET NOT NULL. ` +
        `Column: ${tableName}.${columnName}`,
      { sql: "", binds: [] },
    );
  }

  async changeColumn(tableName: string, columnName: string, _type: string): Promise<void> {
    throw new StatementInvalid(
      `SQLite does not support ALTER TABLE ... ALTER COLUMN TYPE. ` +
        `Column: ${tableName}.${columnName}`,
      { sql: "", binds: [] },
    );
  }

  async renameColumn(tableName: string, columnName: string, newColumnName: string): Promise<void> {
    await this.executeMutation(
      `ALTER TABLE "${tableName}" RENAME COLUMN "${columnName}" TO "${newColumnName}"`,
    );
  }

  async addTimestamps(tableName: string, _options?: Record<string, unknown>): Promise<void> {
    await this.addColumn(tableName, "created_at", "datetime");
    await this.addColumn(tableName, "updated_at", "datetime");
  }

  async addReference(
    tableName: string,
    refName: string,
    _options?: Record<string, unknown>,
  ): Promise<void> {
    await this.addColumn(tableName, `${refName}_id`, "integer");
  }

  async foreignKeys(tableName: string): Promise<Array<Record<string, unknown>>> {
    const rows = await this.execute(`PRAGMA foreign_key_list("${tableName}")`);
    return rows;
  }

  override buildInsertSql(insert: { skipDuplicates?: boolean; update?: unknown }): string | null {
    if (insert.skipDuplicates) {
      return "OR IGNORE";
    }
    if (insert.update) {
      return "ON CONFLICT DO UPDATE SET";
    }
    return null;
  }

  async disableReferentialIntegrity(fn: () => Promise<void>): Promise<void> {
    this.db.pragma("foreign_keys = OFF");
    try {
      await fn();
    } finally {
      this.db.pragma("foreign_keys = ON");
    }
  }

  async checkAllForeignKeysValidBang(): Promise<void> {
    const violations = this.db.pragma("foreign_key_check") as unknown[];
    if (violations.length > 0) {
      throw new Error(`Foreign key violations found: ${violations.length} rows`);
    }
  }

  private _translateException(e: unknown, sql: string, binds: unknown[]): Error {
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as any)?.code as string | undefined;
    const cause = e;

    if (code?.includes("CONSTRAINT_UNIQUE") || msg.includes("UNIQUE constraint failed")) {
      return new RecordNotUnique(msg, { sql, binds, cause });
    }
    if (code?.includes("CONSTRAINT_FOREIGNKEY") || msg.includes("FOREIGN KEY constraint failed")) {
      return new InvalidForeignKey(msg, { sql, binds, cause });
    }
    if (code?.includes("CONSTRAINT_NOTNULL") || msg.includes("NOT NULL constraint failed")) {
      return new NotNullViolation(msg, { sql, binds, cause });
    }
    if (msg.includes("String or BLOB exceeded size limit")) {
      return new ValueTooLong(msg, { sql, binds, cause });
    }
    if (code === "SQLITE_CANTOPEN" || msg.includes("unable to open database file")) {
      return new NoDatabaseError(msg, { sql, binds, cause });
    }
    return new StatementInvalid(msg, { sql, binds, cause });
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3Adapter::StatementPool
 *
 * SQLite3-specific statement pool backed by the generic StatementPool.
 */
export class StatementPool extends GenericStatementPool<Database.Statement> {}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3Adapter::SQLite3Integer
 *
 * SQLite stores integers as up to 8-byte signed values. This type
 * represents the range of values SQLite can natively handle.
 */
export class SQLite3Integer {
  static readonly MIN = -(2n ** 63n);
  static readonly MAX = 2n ** 63n - 1n;

  static inRange(value: bigint | number): boolean {
    const v = BigInt(value);
    return v >= SQLite3Integer.MIN && v <= SQLite3Integer.MAX;
  }
}
