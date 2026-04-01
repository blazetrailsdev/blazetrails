import type { SqlJsStatic } from "sql.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import { VirtualFS } from "./virtual-fs.js";
import { createTrailCLI, type CliResult } from "./trail-cli.js";
import type { MigrationProxy } from "@blazetrails/activerecord";

export type { VirtualFS, VfsFile } from "./virtual-fs.js";
export type { CliResult } from "./trail-cli.js";

export interface Runtime {
  adapter: SqlJsAdapter;
  vfs: VirtualFS;

  executeSQL: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
  getTables: () => string[];

  registerMigration: (proxy: MigrationProxy) => void;
  getMigrations: () => MigrationProxy[];
  clearMigrations: () => void;

  exec: (command: string) => Promise<CliResult>;

  exportDB: () => Uint8Array;
  loadDB: (data: Uint8Array) => void;

  reset: () => void;
}

export async function createRuntime(SQL: SqlJsStatic): Promise<Runtime> {
  let db = new SQL.Database();
  let adapter = new SqlJsAdapter(db);
  let vfs = new VirtualFS(adapter);

  let migrations: MigrationProxy[] = [];

  function executeCode(_code: string): Promise<unknown> {
    // executeCode requires a sandboxed eval context (Function constructor or
    // iframe). This will be implemented when db:migrate support is needed.
    // For now, the generate and new commands work without it.
    return Promise.resolve(undefined);
  }

  async function runAllInDir(_dir: string): Promise<void> {
    // Depends on executeCode — stubbed for same reason.
  }

  function buildCli() {
    return createTrailCLI({
      vfs,
      adapter,
      executeCode,
      getMigrations: () => migrations,
      registerMigration: (proxy) => {
        if (!migrations.find((m) => m.version === proxy.version)) {
          migrations.push(proxy);
        }
      },
      clearMigrations: () => {
        migrations = [];
      },
      getTables: () => adapter.getTables(),
      runAllInDir,
    });
  }

  let cli = buildCli();

  const runtime: Runtime = {
    adapter,
    vfs,

    executeSQL: (sql) => adapter.execRaw(sql),
    getTables: () => adapter.getTables(),

    registerMigration: (proxy) => {
      if (!migrations.find((m) => m.version === proxy.version)) {
        migrations.push(proxy);
      }
    },
    getMigrations: () => migrations,
    clearMigrations: () => {
      migrations = [];
    },

    exec: (command) => cli.exec(command),

    exportDB: () => db.export(),
    loadDB: (data) => {
      db = new SQL.Database(data);
      adapter = new SqlJsAdapter(db);
      vfs = new VirtualFS(adapter);
      runtime.adapter = adapter;
      runtime.vfs = vfs;
      cli = buildCli();
      migrations = [];
    },

    reset: () => {
      for (const f of vfs.list()) vfs.delete(f.path);
      const tables = adapter.getTables().filter((t) => !t.startsWith("_vfs_"));
      for (const table of tables) {
        adapter.execRaw(`DROP TABLE IF EXISTS "${table.replace(/"/g, '""')}"`);
      }
      adapter.execRaw('DROP TABLE IF EXISTS "schema_migrations"');
      migrations = [];
    },
  };

  return runtime;
}
