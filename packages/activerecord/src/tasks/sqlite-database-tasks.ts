/**
 * SQLiteDatabaseTasks — SQLite-specific database lifecycle operations.
 *
 * Mirrors: ActiveRecord::Tasks::SQLiteDatabaseTasks.
 *
 * Unlike Rails (which shells out to the `sqlite3` CLI for structureDump /
 * structureLoad), trails runs these operations through the SQLite3Adapter so
 * the same code works under sqlite-wasm + the activesupport vfs adapter — no
 * subprocess required.
 */

import { getFs, getPath } from "@blazetrails/activesupport";
import type { DatabaseAdapter } from "../adapter.js";
import type { DatabaseConfig } from "../database-configurations/database-config.js";
import { DatabaseTasks } from "./database-tasks.js";
import { NoDatabaseError, DatabaseAlreadyExists } from "../errors.js";

export class SQLiteDatabaseTasks {
  private readonly dbConfig: DatabaseConfig;
  private readonly root: string;

  static usingDatabaseConfigurations(): boolean {
    return true;
  }

  constructor(dbConfig: DatabaseConfig, root: string = DatabaseTasks.root) {
    this.dbConfig = dbConfig;
    this.root = root;
  }

  async create(): Promise<void> {
    const fs = getFs();
    const path = getPath();
    const dbPath = this.resolveDbPath();
    if (dbPath !== ":memory:" && fs.existsSync(dbPath)) {
      throw new DatabaseAlreadyExists(`Database '${dbPath}' already exists`);
    }
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, "");
    }
  }

  async drop(): Promise<void> {
    const fs = getFs();
    const dbPath = this.resolveDbPath();
    if (dbPath === ":memory:") return;
    try {
      fs.unlinkSync(dbPath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new NoDatabaseError((error as Error).message);
      }
      throw error;
    }
    for (const suffix of ["-shm", "-wal"]) {
      try {
        fs.unlinkSync(dbPath + suffix);
      } catch {
        // ignore
      }
    }
  }

  async purge(): Promise<void> {
    await this.disconnect();
    try {
      await this.drop();
    } catch (error) {
      if (!(error instanceof NoDatabaseError)) throw error;
    }
    await this.create();
    await this.reconnect();
  }

  private async disconnect(): Promise<void> {
    try {
      const { Base } = await import("../base.js");
      const existing = (Base as unknown as { adapter?: { close?: () => Promise<void> } }).adapter;
      if (existing && typeof existing.close === "function") await existing.close();
    } catch {
      // best effort
    }
  }

  private async reconnect(): Promise<void> {
    try {
      const { Base } = await import("../base.js");
      await Base.establishConnection({ adapter: "sqlite3", database: this.resolveDbPath() });
    } catch {
      // best effort
    }
  }

  charset(): string {
    return "UTF-8";
  }

  async structureDump(filename: string, extraFlags?: string | string[] | null): Promise<void> {
    void extraFlags;
    const adapter = await this.connectAdapter();
    try {
      const { SchemaDumper } = await import("../connection-adapters/abstract/schema-dumper.js");
      const ignoreTables = SchemaDumper.ignoreTables;

      let query: string;
      if (ignoreTables.length > 0) {
        // Resolve patterns against the live table list (Rails does the same —
        // string names + regex patterns both need the current sqlite_master
        // row to compare against).
        const tablesRows = (await adapter.execute(
          "SELECT tbl_name FROM sqlite_master WHERE type IN ('table','view','index','trigger')",
        )) as Array<Record<string, unknown>>;
        const allTables = Array.from(
          new Set(tablesRows.map((r) => String(r.tbl_name ?? "")).filter(Boolean)),
        );
        const excluded = allTables.filter((name) =>
          ignoreTables.some((pat) => (pat instanceof RegExp ? pat.test(name) : pat === name)),
        );
        if (excluded.length > 0) {
          const list = excluded.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ");
          query =
            `SELECT sql || ';' AS sql FROM sqlite_master ` +
            `WHERE sql IS NOT NULL AND tbl_name NOT IN (${list}) ` +
            `ORDER BY tbl_name, type DESC, name`;
        } else {
          query =
            `SELECT sql || ';' AS sql FROM sqlite_master ` +
            `WHERE sql IS NOT NULL ORDER BY tbl_name, type DESC, name`;
        }
      } else {
        query =
          `SELECT sql || ';' AS sql FROM sqlite_master ` +
          `WHERE sql IS NOT NULL ORDER BY tbl_name, type DESC, name`;
      }

      const rows = (await adapter.execute(query)) as Array<Record<string, unknown>>;
      const output = rows.map((r) => String(r.sql ?? "")).join("\n");
      getFs().writeFileSync(filename, output);
    } finally {
      await this.closeAdapter(adapter);
    }
  }

  async structureLoad(filename: string, extraFlags?: string | string[] | null): Promise<void> {
    void extraFlags;
    const sql = getFs().readFileSync(filename, "utf8");
    const adapter = await this.connectAdapter();
    try {
      for (const statement of splitSqlStatements(sql)) {
        await adapter.executeMutation(statement);
      }
    } finally {
      await this.closeAdapter(adapter);
    }
  }

  private resolveDbPath(): string {
    const path = getPath();
    const database = this.dbConfig.database;
    if (!database) {
      throw new Error("SQLite database configuration missing 'database' path");
    }
    if (database === ":memory:" || path.isAbsolute(database)) return database;
    return path.join(this.root, database);
  }

  private async connectAdapter(): Promise<DatabaseAdapter> {
    const { SQLite3Adapter } = await import("../connection-adapters/sqlite3-adapter.js");
    return new SQLite3Adapter(this.resolveDbPath());
  }

  private async closeAdapter(adapter: DatabaseAdapter): Promise<void> {
    const close = (adapter as { close?: () => Promise<void> }).close;
    if (typeof close === "function") await close.call(adapter);
  }

  static register(): void {
    DatabaseTasks.registerTask(/sqlite/, {
      create: async (config) => new SQLiteDatabaseTasks(config).create(),
      drop: async (config) => new SQLiteDatabaseTasks(config).drop(),
      purge: async (config) => new SQLiteDatabaseTasks(config).purge(),
      charset: async (config) => new SQLiteDatabaseTasks(config).charset(),
      structureDump: async (config, filename, flags) =>
        new SQLiteDatabaseTasks(config).structureDump(filename, flags),
      structureLoad: async (config, filename, flags) =>
        new SQLiteDatabaseTasks(config).structureLoad(filename, flags),
    });
  }
}

/**
 * Split a SQL script into individual statements on semicolon boundaries,
 * respecting string literals ('...' and "..."), line comments (-- ...) and
 * block comments (slash-star ... star-slash). Simple enough for
 * structure-load files (which are DDL the adapter itself produced) but not a
 * full SQL parser.
 */
function splitSqlStatements(sql: string): string[] {
  const result: string[] = [];
  let buf = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      buf += ch;
      i++;
      while (i < n) {
        buf += sql[i];
        if (sql[i] === quote && sql[i + 1] !== quote) {
          i++;
          break;
        }
        if (sql[i] === quote && sql[i + 1] === quote) {
          buf += sql[i + 1];
          i += 2;
          continue;
        }
        i++;
      }
      continue;
    }
    if (ch === ";") {
      const stmt = buf.trim();
      if (stmt) result.push(stmt);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail) result.push(tail);
  return result;
}
