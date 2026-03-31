import type { SqlJsStatic } from "sql.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import { VirtualFS } from "./virtual-fs.js";
import { CompiledCache } from "./compiled-cache.js";
import { VersionHistory } from "./version-history.js";
import { createTrailCLI, type CliResult } from "./trail-cli.js";
import { createAppServer, type AppServer, type AppResponse } from "./app-server.js";
import { defaultFiles } from "./default-files.js";
import { Base, Migration, MigrationRunner, Migrator, Schema } from "@blazetrails/activerecord";
import { ActionController } from "@blazetrails/actionpack";
import type { MigrationProxy } from "@blazetrails/activerecord";

export type { VirtualFS, VfsFile } from "./virtual-fs.js";
export type { CompiledCache } from "./compiled-cache.js";
export type { VersionHistory } from "./version-history.js";

export interface MigrationStatus {
  status: "up" | "down";
  version: string;
  name: string;
}

export interface DbTaskResult {
  success: boolean;
  message: string;
  output?: string[];
}

export interface Runtime {
  adapter: SqlJsAdapter;
  vfs: VirtualFS;
  compiled: CompiledCache;
  history: VersionHistory;
  Base: typeof Base;
  Migration: typeof Migration;
  MigrationRunner: typeof MigrationRunner;
  Migrator: typeof Migrator;
  Schema: typeof Schema;

  executeCode: (code: string) => Promise<unknown>;
  executeSQL: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
  getTables: () => string[];
  getColumns: (
    table: string,
  ) => Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
  getTableData: (table: string, limit?: number) => { columns: string[]; rows: unknown[][] };
  getRowCount: (table: string) => number;

  registerMigration: (proxy: MigrationProxy) => void;
  getMigrations: () => MigrationProxy[];
  clearMigrations: () => void;
  dbSetup: () => Promise<DbTaskResult>;
  dbReset: () => Promise<DbTaskResult>;
  dbMigrate: () => Promise<DbTaskResult>;
  dbRollback: (steps?: number) => Promise<DbTaskResult>;
  dbMigrateStatus: () => Promise<MigrationStatus[]>;
  dbSeed: (code: string) => Promise<DbTaskResult>;
  dbDrop: () => DbTaskResult;
  dbSchema: () => string;

  /** Run all files in a directory in sorted order. */
  runAllInDir: (dir: string) => Promise<DbTaskResult>;

  /** Execute a CLI command (e.g. "db:migrate", "db:rollback --step 2"). */
  exec: (command: string) => Promise<CliResult>;

  /** The app server — ActionPack routing + controllers in the browser. */
  app: AppServer;
  /** Shorthand for app.call */
  request: (method: string, path: string) => Promise<AppResponse>;

  /** Export the current database as a Uint8Array (full SQLite file). */
  exportDB: () => Uint8Array;
  /** Load a database from a Uint8Array, replacing the current one. */
  loadDB: (data: Uint8Array) => void;
  /** Create a fresh database with default scaffold files. */
  newProject: () => void;

  reset: () => void;
}

let SQL: SqlJsStatic;

export async function initSQL(): Promise<SqlJsStatic> {
  if (!SQL) {
    // sql.js uses UMD — handle both default and named exports
    const mod = await import("sql.js");
    const initSqlJs = (mod as any).default ?? mod;
    SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  }
  return SQL;
}

export async function createRuntime(initialData?: Uint8Array): Promise<Runtime> {
  const sql = await initSQL();

  let db = initialData ? new sql.Database(initialData) : new sql.Database();
  let adapter = new SqlJsAdapter(db);
  Base.adapter = adapter;

  let vfs = new VirtualFS(adapter);
  let compiled = new CompiledCache(adapter);
  let history = new VersionHistory(adapter);
  let registeredMigrations: MigrationProxy[] = [];
  // CLI initialized after runtime object is created

  // Seed default files only for brand new databases
  if (!initialData) {
    vfs.seedDefaults(defaultFiles);
  }

  function buildMigrator(): Migrator {
    return new Migrator(adapter, registeredMigrations);
  }

  /** Run all migration files in db/migrations/ to register them if not already registered. */
  async function ensureMigrationsRegistered(): Promise<string[]> {
    const migrationFiles = vfs
      .list()
      .filter((f) => f.path.startsWith("db/migrations/") && f.path.endsWith(".ts"))
      .sort((a, b) => a.path.localeCompare(b.path));

    if (migrationFiles.length === 0) return [];

    const output: string[] = [];
    const countBefore = registeredMigrations.length;

    for (const file of migrationFiles) {
      // Skip if this file has likely already been loaded
      // Check if any registered migration's version appears in the file content
      const alreadyLoaded = registeredMigrations.some(
        (m) => file.content.includes(`"${m.version}"`) || file.content.includes(`'${m.version}'`),
      );
      if (alreadyLoaded) continue;

      try {
        output.push(`Loading ${file.path}...`);
        await runtime.executeCode(file.content);
      } catch (e: any) {
        output.push(`  Error: ${e.message}`);
      }
    }

    const newCount = registeredMigrations.length - countBefore;
    if (newCount > 0) {
      output.push(`Registered ${newCount} migration(s).`);
    }
    return output;
  }

  function replaceDB(newDb: InstanceType<SqlJsStatic["Database"]>) {
    db.close();
    db = newDb;
    adapter = new SqlJsAdapter(db);
    Base.adapter = adapter;
    runtime.adapter = adapter;
    vfs = new VirtualFS(adapter);
    runtime.vfs = vfs;
    compiled = new CompiledCache(adapter);
    runtime.compiled = compiled;
    history = new VersionHistory(adapter);
    runtime.history = history;
    registeredMigrations = [];
  }

  const runtime: Runtime = {
    adapter,
    vfs,
    compiled,
    history,
    Base,
    Migration,
    MigrationRunner,
    Migrator,
    Schema,

    async executeCode(code: string): Promise<unknown> {
      const fn = new Function(
        "Base",
        "Migration",
        "MigrationRunner",
        "Migrator",
        "Schema",
        "ActionController",
        "adapter",
        "runtime",
        "exec",
        "app",
        "request",
        `return (async () => { ${code} })();`,
      );
      return fn(
        Base,
        Migration,
        MigrationRunner,
        Migrator,
        Schema,
        ActionController,
        adapter,
        runtime,
        runtime.exec,
        runtime.app,
        runtime.request,
      );
    },

    executeSQL(sql: string) {
      return adapter.execRaw(sql);
    },

    getTables() {
      return adapter.getTables().filter((t) => !t.startsWith("_vfs_"));
    },

    getColumns(table: string) {
      return adapter.getColumns(table);
    },

    getTableData(table: string, limit = 100) {
      const results = adapter.execRaw(`SELECT * FROM "${table}" LIMIT ${limit}`);
      if (!results.length) return { columns: [], rows: [] };
      return { columns: results[0].columns, rows: results[0].values };
    },

    getRowCount(table: string) {
      const results = adapter.execRaw(`SELECT COUNT(*) as c FROM "${table}"`);
      return (results[0]?.values[0]?.[0] as number) ?? 0;
    },

    registerMigration(proxy: MigrationProxy) {
      registeredMigrations.push(proxy);
      registeredMigrations.sort((a, b) => {
        const va = BigInt(a.version);
        const vb = BigInt(b.version);
        if (va < vb) return -1;
        if (va > vb) return 1;
        return 0;
      });
    },

    getMigrations() {
      return [...registeredMigrations];
    },

    clearMigrations() {
      registeredMigrations = [];
    },

    async dbSetup(): Promise<DbTaskResult> {
      try {
        const loadOutput = await ensureMigrationsRegistered();
        const migrator = buildMigrator();
        await migrator.migrate();
        const output = [...loadOutput, ...migrator.output];
        const pending = await migrator.pendingMigrations();
        return {
          success: true,
          message:
            pending.length === 0
              ? `Database setup complete. ${migrator.output.length / 2} migration(s) applied.`
              : `Setup complete with ${pending.length} pending migration(s).`,
          output,
        };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    },

    async dbReset(): Promise<DbTaskResult> {
      try {
        const tables = adapter.getTables().filter((t) => !t.startsWith("_vfs_"));
        for (const table of tables) {
          adapter.execRaw(`DROP TABLE IF EXISTS "${table}"`);
        }
        adapter.execRaw('DROP TABLE IF EXISTS "schema_migrations"');
        const loadOutput = await ensureMigrationsRegistered();
        const migrator = buildMigrator();
        await migrator.migrate();
        const output = [...loadOutput, ...migrator.output];
        return {
          success: true,
          message: `Database reset. ${migrator.output.length / 2} migration(s) applied.`,
          output,
        };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    },

    async dbMigrate(): Promise<DbTaskResult> {
      try {
        const loadOutput = await ensureMigrationsRegistered();
        const migrator = buildMigrator();
        const pendingBefore = await migrator.pendingMigrations();
        await migrator.migrate();
        const output = [...loadOutput, ...migrator.output];
        return {
          success: true,
          message:
            pendingBefore.length === 0
              ? "No pending migrations."
              : `${pendingBefore.length} migration(s) applied.`,
          output,
        };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    },

    async dbRollback(steps = 1): Promise<DbTaskResult> {
      try {
        const migrator = buildMigrator();
        await migrator.rollback(steps);
        const output = [...migrator.output];
        return {
          success: true,
          message: `Rolled back ${steps} migration(s).`,
          output,
        };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    },

    async dbMigrateStatus(): Promise<MigrationStatus[]> {
      const results: MigrationStatus[] = [];

      // Get applied versions from schema_migrations table
      let appliedVersions = new Set<string>();
      try {
        const rows = await adapter.execute('SELECT "version" FROM "schema_migrations"');
        appliedVersions = new Set(rows.map((r) => String(r.version)));
      } catch {
        // Table doesn't exist yet — no migrations applied
      }

      // If we have registered migrations, use the Migrator for accurate status
      if (registeredMigrations.length > 0) {
        try {
          const migrator = buildMigrator();
          return await migrator.migrationsStatus();
        } catch {
          // Fall through to manual check
        }
      }

      // Discover migration files from VFS
      const migrationFiles = vfs
        .list()
        .filter((f) => f.path.startsWith("db/migrations/"))
        .sort((a, b) => a.path.localeCompare(b.path));

      for (const file of migrationFiles) {
        // Try to extract version from filename (e.g. 001_create_users.ts -> 001)
        const match = file.path.match(/\/(\d+)/);
        const version = match?.[1] ?? "";
        const name = file.path.split("/").pop()?.replace(/\.ts$/, "") ?? file.path;
        results.push({
          version,
          name,
          status: appliedVersions.has(version) ? "up" : "down",
        });
      }

      // Also show any applied versions not matched to a file
      for (const v of appliedVersions) {
        if (!results.some((r) => r.version === v)) {
          results.push({ version: v, name: "(no file)", status: "up" });
        }
      }

      return results;
    },

    async dbSeed(code: string): Promise<DbTaskResult> {
      try {
        await runtime.executeCode(code);
        return { success: true, message: "Seed complete." };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    },

    dbDrop(): DbTaskResult {
      const tables = adapter.getTables().filter((t) => !t.startsWith("_vfs_"));
      for (const table of tables) {
        adapter.execRaw(`DROP TABLE IF EXISTS "${table}"`);
      }
      adapter.execRaw('DROP TABLE IF EXISTS "schema_migrations"');
      return { success: true, message: `Dropped ${tables.length} table(s).` };
    },

    dbSchema(): string {
      const tables = adapter.getTables().filter((t) => !t.startsWith("_vfs_"));
      const lines: string[] = [];
      for (const table of tables) {
        const cols = adapter.getColumns(table);
        lines.push(`CREATE TABLE "${table}" (`);
        lines.push(
          cols
            .map((c) => {
              let def = `  "${c.name}" ${c.type || "TEXT"}`;
              if (c.pk) def += " PRIMARY KEY";
              if (c.notnull) def += " NOT NULL";
              return def;
            })
            .join(",\n"),
        );
        lines.push(");");
        lines.push("");
      }
      return lines.join("\n");
    },

    async runAllInDir(dir: string): Promise<DbTaskResult> {
      const allFiles = vfs
        .list()
        .filter((f) => f.path.startsWith(dir + "/"))
        .sort((a, b) => a.path.localeCompare(b.path));
      if (allFiles.length === 0) return { success: true, message: `No files in ${dir}/` };
      const output: string[] = [];
      try {
        for (const file of allFiles) {
          output.push(`Running ${file.path}...`);
          await runtime.executeCode(file.content);
          output.push(`  done`);
        }
        return { success: true, message: `Ran ${allFiles.length} file(s) from ${dir}/`, output };
      } catch (e: any) {
        return { success: false, message: e.message, output };
      }
    },

    exportDB(): Uint8Array {
      return db.export();
    },

    loadDB(data: Uint8Array) {
      replaceDB(new sql.Database(data));
    },

    newProject() {
      replaceDB(new sql.Database());
      vfs.seedDefaults(defaultFiles);
    },

    reset() {
      replaceDB(new sql.Database());
      vfs.seedDefaults(defaultFiles);
    },

    // Placeholder — set after runtime object is created
    app: null as any,
    request: null as any,
  };

  // Initialize app server
  const appServer = createAppServer(runtime);
  runtime.app = appServer;
  runtime.request = (method: string, path: string) => appServer.call(method, path);

  const cli = createTrailCLI(runtime);
  runtime.exec = (command: string) => cli.exec(command);

  return runtime;
}
