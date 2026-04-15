import mysql from "mysql2/promise";
import type { DatabaseAdapter } from "../adapter.js";
import { DatabaseStatementsMixin } from "../connection-adapters/database-statements-mixin.js";
import { Column } from "../connection-adapters/column.js";
import { SqlTypeMetadata } from "../connection-adapters/sql-type-metadata.js";

const AdapterBase = DatabaseStatementsMixin(class {});

/**
 * MySQL adapter — connects ActiveRecord to a real MySQL/MariaDB database.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Mysql2Adapter
 *
 * Accepts either a connection URI (`mysql://...`) or a `mysql2` pool config
 * object. Uses a connection pool internally for concurrent access.
 */
export class Mysql2Adapter extends AdapterBase implements DatabaseAdapter {
  readonly adapterName = "Mysql2";

  private pool: mysql.Pool;
  private _conn: mysql.PoolConnection | null = null;
  private _inTransaction = false;

  constructor(config: string | mysql.PoolOptions) {
    super();
    if (typeof config === "string") {
      this.pool = mysql.createPool({ uri: config });
    } else {
      this.pool = mysql.createPool(config);
    }
  }

  /**
   * Get the active connection — either the transaction connection or a fresh
   * one from the pool.
   */
  private async getConn(): Promise<mysql.PoolConnection> {
    if (this._conn) return this._conn;
    return this.pool.getConnection();
  }

  /**
   * Release a connection back to the pool (only if not in a transaction).
   */
  private releaseConn(conn: mysql.PoolConnection): void {
    if (conn !== this._conn) {
      conn.release();
    }
  }

  /**
   * Convert double-quoted identifiers to backtick-quoted for MySQL/MariaDB.
   *
   * CONVENTION: Arel-generated DML and SQL builders (Relation, InsertAll, etc.)
   * use standard double-quoted identifiers ("table"."column"). This method
   * converts them to backticks at execution time, so MySQL-specific quoting is
   * handled in one place rather than threaded through every SQL builder.
   * Adapter-specific DDL or raw SQL fragments may still use backticks or
   * quoteIdentifier(..., "mysql") directly where appropriate.
   */
  private mysqlQuote(sql: string): string {
    // Replace "identifier" with `identifier`, but not inside single-quoted strings.
    // Split on single-quoted strings, only transform non-string parts.
    const parts = sql.split(/('(?:[^'\\]|\\.)*')/);
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = parts[i].replace(/"/g, "`");
    }
    let result = parts.join("");

    // MySQL requires LIMIT when using OFFSET; add a large LIMIT if missing
    if (/\bOFFSET\b/i.test(result) && !/\bLIMIT\b/i.test(result)) {
      result = result.replace(/\bOFFSET\b/i, "LIMIT 18446744073709551615 OFFSET");
    }

    return result;
  }

  /**
   * Convert boolean values in binds to integers for MySQL compatibility.
   */
  private mysqlBinds(binds: unknown[]): unknown[] {
    return binds.map((v) => (v === true ? 1 : v === false ? 0 : v));
  }

  /**
   * Execute a SELECT query and return rows.
   */
  async execute(sql: string, binds: unknown[] = []): Promise<Record<string, unknown>[]> {
    const conn = await this.getConn();
    try {
      const [rows] = await conn.query(this.mysqlQuote(sql), this.mysqlBinds(binds));
      return rows as Record<string, unknown>[];
    } finally {
      this.releaseConn(conn);
    }
  }

  /**
   * Execute an INSERT/UPDATE/DELETE and return affected rows or insert ID.
   */
  async executeMutation(sql: string, binds: unknown[] = []): Promise<number> {
    const conn = await this.getConn();
    try {
      const [result] = await conn.query(this.mysqlQuote(sql), this.mysqlBinds(binds));
      const info = result as mysql.ResultSetHeader;

      // For INSERT, return the last inserted ID (or affected rows for multi-row)
      if (sql.trimStart().toUpperCase().startsWith("INSERT")) {
        if (info.affectedRows > 1) {
          return info.affectedRows;
        }
        return info.insertId;
      }

      // For UPDATE/DELETE, return affected rows
      return info.affectedRows;
    } finally {
      this.releaseConn(conn);
    }
  }

  /**
   * Begin a transaction. Acquires a dedicated connection from the pool.
   */
  async beginTransaction(): Promise<void> {
    this._conn = await this.pool.getConnection();
    await this._conn.query("BEGIN");
    this._inTransaction = true;
  }

  async beginDbTransaction(): Promise<void> {
    return this.beginTransaction();
  }

  async beginDeferredTransaction(): Promise<void> {
    return this.beginTransaction();
  }

  /**
   * Commit the current transaction and release the connection.
   */
  async commit(): Promise<void> {
    if (!this._conn) throw new Error("No active transaction");
    await this._conn.query("COMMIT");
    this._conn.release();
    this._conn = null;
    this._inTransaction = false;
  }

  async commitDbTransaction(): Promise<void> {
    return this.commit();
  }

  /**
   * Rollback the current transaction and release the connection.
   */
  async rollback(): Promise<void> {
    if (!this._conn) throw new Error("No active transaction");
    await this._conn.query("ROLLBACK");
    this._conn.release();
    this._conn = null;
    this._inTransaction = false;
  }

  async rollbackDbTransaction(): Promise<void> {
    return this.rollback();
  }

  /**
   * Create a savepoint (nested transaction).
   */
  async createSavepoint(name: string): Promise<void> {
    const conn = await this.getConn();
    try {
      await conn.query(`SAVEPOINT \`${name}\``);
    } finally {
      this.releaseConn(conn);
    }
  }

  /**
   * Release a savepoint.
   */
  async releaseSavepoint(name: string): Promise<void> {
    const conn = await this.getConn();
    try {
      await conn.query(`RELEASE SAVEPOINT \`${name}\``);
    } finally {
      this.releaseConn(conn);
    }
  }

  /**
   * Rollback to a savepoint.
   */
  async rollbackToSavepoint(name: string): Promise<void> {
    const conn = await this.getConn();
    try {
      await conn.query(`ROLLBACK TO SAVEPOINT \`${name}\``);
    } finally {
      this.releaseConn(conn);
    }
  }

  /**
   * Return the query execution plan.
   */
  async explain(sql: string): Promise<string> {
    const conn = await this.getConn();
    try {
      const [rows] = await conn.query(`EXPLAIN ${this.mysqlQuote(sql)}`);
      return (rows as any[]).map((r: any) => JSON.stringify(r)).join("\n");
    } finally {
      this.releaseConn(conn);
    }
  }

  /**
   * Execute raw SQL (for DDL and other non-query statements).
   */
  async exec(sql: string): Promise<void> {
    const conn = await this.getConn();
    try {
      await conn.query(this.mysqlQuote(sql));
    } finally {
      this.releaseConn(conn);
    }
  }

  // ── Schema introspection ──
  // Mirrors Rails' MySQL SchemaStatements (connection_adapters/mysql/
  // schema_statements.rb + abstract_mysql_adapter.rb). All queries
  // scope to the current database via information_schema.

  /**
   * List all BASE TABLEs in the current database, matching Rails'
   * `data_source_sql(type: "BASE TABLE")` shape.
   */
  async tables(): Promise<string[]> {
    const rows = await this.execute(
      `SELECT table_name AS name FROM information_schema.tables
         WHERE table_schema = database() AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
    );
    return rows.map((r) => (r.name ?? r.NAME ?? r.TABLE_NAME) as string);
  }

  /**
   * List all VIEWs in the current database, matching Rails'
   * `data_source_sql(type: "VIEW")`.
   */
  async views(): Promise<string[]> {
    const rows = await this.execute(
      `SELECT table_name AS name FROM information_schema.tables
         WHERE table_schema = database() AND table_type = 'VIEW'
         ORDER BY table_name`,
    );
    return rows.map((r) => (r.name ?? r.NAME ?? r.TABLE_NAME) as string);
  }

  /**
   * Tables + views, deduped. Matches Rails'
   * `AbstractAdapter#data_sources` — the name SchemaCache.addAll calls
   * through.
   */
  async dataSources(): Promise<string[]> {
    const rows = await this.execute(
      `SELECT table_name AS name FROM information_schema.tables
         WHERE table_schema = database()
         ORDER BY table_name`,
    );
    return rows.map((r) => (r.name ?? r.NAME ?? r.TABLE_NAME) as string);
  }

  async tableExists(name: string): Promise<boolean> {
    return this.informationSchemaExists(name, "BASE TABLE");
  }

  async viewExists(name: string): Promise<boolean> {
    return this.informationSchemaExists(name, "VIEW");
  }

  async dataSourceExists(name: string): Promise<boolean> {
    return this.informationSchemaExists(name, null);
  }

  private async informationSchemaExists(
    name: string,
    type: "BASE TABLE" | "VIEW" | null,
  ): Promise<boolean> {
    const { schema, table } = this.parseMysqlName(name);
    const schemaBind = schema ?? null;
    // Use `schema_placeholder OR database()` via COALESCE so the same
    // query shape serves qualified + unqualified callers.
    const typeClause = type ? "AND table_type = ?" : "";
    const params: unknown[] = [schemaBind, table];
    if (type) params.push(type);
    const rows = await this.execute(
      `SELECT 1 AS one FROM information_schema.tables
         WHERE table_schema = COALESCE(?, database())
         AND table_name = ?
         ${typeClause}
         LIMIT 1`,
      params,
    );
    return rows.length > 0;
  }

  /**
   * Return the single-column primary key name, or null for composite /
   * no-PK tables. Matches Rails' `abstract_mysql_adapter#primary_keys`
   * shape (which returns an array; we return a scalar for the common
   * case and null for composite).
   */
  async primaryKey(tableName: string): Promise<string | null> {
    const { schema, table } = this.parseMysqlName(tableName);
    const rows = (await this.execute(
      `SELECT column_name AS name FROM information_schema.key_column_usage
         WHERE table_schema = COALESCE(?, database())
         AND table_name = ?
         AND constraint_name = 'PRIMARY'
         ORDER BY ordinal_position`,
      [schema ?? null, table],
    )) as Array<{ name?: string; NAME?: string; COLUMN_NAME?: string }>;
    const names = rows.map((r) => (r.name ?? r.NAME ?? r.COLUMN_NAME) as string);
    if (names.length === 1) return names[0];
    return null;
  }

  /**
   * Return Column metadata for the named table. Reads from
   * `information_schema.columns` — matches Rails' column introspection
   * shape. Populates the fields SchemaCache serializes (name, default,
   * null, sqlTypeMetadata, primaryKey).
   */
  async columns(tableName: string): Promise<Column[]> {
    const { schema, table } = this.parseMysqlName(tableName);
    const rows = (await this.execute(
      `SELECT column_name AS name,
              column_default AS default_value,
              is_nullable AS nullable,
              data_type AS type,
              column_type AS full_type,
              character_maximum_length AS char_len,
              numeric_precision AS num_precision,
              numeric_scale AS num_scale,
              column_key AS col_key,
              extra AS col_extra,
              collation_name AS collation,
              column_comment AS comment
         FROM information_schema.columns
         WHERE table_schema = COALESCE(?, database())
         AND table_name = ?
         ORDER BY ordinal_position`,
      [schema ?? null, table],
    )) as Array<Record<string, unknown>>;

    return rows.map((r) => {
      const name = String((r.name ?? r.NAME ?? r.COLUMN_NAME) as string);
      const sqlType = String((r.full_type ?? r.FULL_TYPE ?? r.COLUMN_TYPE ?? "") as string);
      const baseType = String((r.type ?? r.TYPE ?? r.DATA_TYPE ?? "") as string).toLowerCase();
      const charLen = r.char_len ?? r.CHAR_LEN ?? r.CHARACTER_MAXIMUM_LENGTH;
      const numPrec = r.num_precision ?? r.NUM_PRECISION ?? r.NUMERIC_PRECISION;
      const numScale = r.num_scale ?? r.NUM_SCALE ?? r.NUMERIC_SCALE;
      const meta = new SqlTypeMetadata({
        sqlType,
        type: baseType,
        limit: charLen != null ? Number(charLen) : null,
        precision: numPrec != null ? Number(numPrec) : null,
        scale: numScale != null ? Number(numScale) : null,
      });
      const nullable =
        String((r.nullable ?? r.NULLABLE ?? r.IS_NULLABLE ?? "YES") as string).toUpperCase() !==
        "NO";
      const colKey = String((r.col_key ?? r.COL_KEY ?? r.COLUMN_KEY ?? "") as string);
      return new Column(name, r.default_value ?? r.DEFAULT_VALUE ?? null, meta, nullable, {
        collation: (r.collation ?? r.COLLATION ?? null) as string | null,
        comment: (r.comment ?? r.COMMENT ?? null) as string | null,
        primaryKey: colKey === "PRI",
      });
    });
  }

  /**
   * Return user-defined indexes for the given table. Matches Rails'
   * MySQL SchemaStatements#indexes which reads from
   * `information_schema.statistics` and filters out PRIMARY.
   */
  async indexes(
    tableName: string,
  ): Promise<Array<{ name: string; columns: string[]; unique: boolean }>> {
    const { schema, table } = this.parseMysqlName(tableName);
    const rows = (await this.execute(
      `SELECT index_name AS name,
              column_name AS col,
              non_unique AS non_unique,
              seq_in_index AS pos
         FROM information_schema.statistics
         WHERE table_schema = COALESCE(?, database())
         AND table_name = ?
         AND index_name <> 'PRIMARY'
         ORDER BY index_name, seq_in_index`,
      [schema ?? null, table],
    )) as Array<Record<string, unknown>>;

    const byIndex = new Map<string, { columns: string[]; unique: boolean }>();
    for (const r of rows) {
      const name = String((r.name ?? r.NAME ?? r.INDEX_NAME) as string);
      const col = String((r.col ?? r.COL ?? r.COLUMN_NAME) as string);
      const nonUnique = Number(r.non_unique ?? r.NON_UNIQUE ?? 0);
      const entry = byIndex.get(name) ?? { columns: [], unique: nonUnique === 0 };
      entry.columns.push(col);
      byIndex.set(name, entry);
    }
    return Array.from(byIndex.entries()).map(([name, { columns, unique }]) => ({
      name,
      columns,
      unique,
    }));
  }

  /**
   * Split a `schema.table` or `` `schema`.`table` `` into `{schema, table}`.
   * Matches Rails' `extract_schema_qualified_name` regex from
   * `mysql/schema_statements.rb`. Returns `schema: undefined` when
   * `name` is an unqualified identifier.
   */
  private parseMysqlName(name: string): { schema?: string; table: string } {
    const parts = name.match(/[^`.\s]+|`[^`]*`/g) ?? [name];
    const unquote = (s: string): string =>
      s.startsWith("`") && s.endsWith("`") ? s.slice(1, -1).replace(/``/g, "`") : s;
    if (parts.length >= 2) {
      return { schema: unquote(parts[0]), table: unquote(parts[1]) };
    }
    return { table: unquote(parts[0] ?? name) };
  }

  /**
   * Close the connection pool.
   */
  async close(): Promise<void> {
    if (this._conn) {
      this._conn.release();
      this._conn = null;
    }
    await this.pool.end();
  }

  /**
   * Check if we're in a transaction.
   */
  get inTransaction(): boolean {
    return this._inTransaction;
  }

  override emptyInsertStatementValue(): string {
    return "VALUES ()";
  }

  /**
   * Get the underlying mysql2 Pool instance.
   * Escape hatch for advanced usage.
   */
  get raw(): mysql.Pool {
    return this.pool;
  }
}
