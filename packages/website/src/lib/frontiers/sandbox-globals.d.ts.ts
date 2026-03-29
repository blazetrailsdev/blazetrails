/**
 * Type declarations for the Frontiers sandbox globals.
 * These are loaded into Monaco for autocomplete.
 * Exported as a string so it can be tested.
 */
export const SANDBOX_GLOBALS_DTS = `
// --- ActiveRecord ---

/** ActiveRecord Base class — define models by extending this. */
declare class Base {
  static tableName: string;
  static attribute(name: string, type: string): void;
  static hasMany(name: string, options?: Record<string, unknown>): void;
  static belongsTo(name: string, options?: Record<string, unknown>): void;
  static hasOne(name: string, options?: Record<string, unknown>): void;
  static connection: any;
}

/** Migration base class — define migrations by extending this. */
declare class Migration {
  version: string;
  adapter: any;
  schema: {
    createTable(name: string, fn?: (t: TableDefinition) => void): Promise<void>;
  };
  createTable(name: string, fn?: (t: TableDefinition) => void): Promise<void>;
  dropTable(name: string): Promise<void>;
  addColumn(table: string, column: string, type: string): Promise<void>;
  removeColumn(table: string, column: string): Promise<void>;
  addIndex(table: string, columns: string | string[], options?: { unique?: boolean }): Promise<void>;
  run(adapter: any, direction: "up" | "down"): Promise<void>;
}

interface TableDefinition {
  string(name: string): void;
  text(name: string): void;
  integer(name: string): void;
  float(name: string): void;
  decimal(name: string): void;
  boolean(name: string): void;
  date(name: string): void;
  datetime(name: string): void;
  timestamps(): void;
  references(name: string, options?: { foreignKey?: boolean; polymorphic?: boolean }): void;
}

declare const MigrationRunner: any;
declare const Migrator: any;

/** Schema — define database schema declaratively. */
declare const Schema: {
  define(adapter: any, fn: (schema: { createTable(name: string, fn?: (t: TableDefinition) => void): Promise<void> }) => void | Promise<void>): Promise<void>;
};

// --- ActionController ---

declare namespace ActionController {
  class Base {
    params: { get(key: string): string | undefined };
    request: any;
    response: any;
    render(options: {
      json?: unknown;
      plain?: string;
      html?: string;
      status?: number | string;
    }): void;
    redirectTo(url: string): void;
    flash: Record<string, string>;
    session: Record<string, unknown>;
    protected performed: boolean;
  }
}

// --- Database adapter ---

declare const adapter: {
  /** Run a SELECT query. Returns rows as objects. */
  execute(sql: string, binds?: unknown[]): Promise<Record<string, unknown>[]>;
  /** Run INSERT/UPDATE/DELETE. Returns last insert ID or rows affected. */
  executeMutation(sql: string, binds?: unknown[]): Promise<number>;
  /** Run raw SQL. Returns array of { columns, values } result sets. */
  execRaw(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  /** List all user tables. */
  getTables(): string[];
  /** Get column info for a table. */
  getColumns(table: string): Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
};

// --- Runtime ---

interface CliResult {
  success: boolean;
  output: string[];
  exitCode: number;
}

interface AppResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Execute a CLI command (e.g. "db:migrate", "scaffold Post title:string"). */
declare function exec(command: string): Promise<CliResult>;

/** Make an HTTP request through the app server. */
declare function request(method: string, path: string): Promise<AppResponse>;

/** The app server — register controllers and draw routes. */
declare const app: {
  call(method: string, path: string, options?: { headers?: Record<string, string>; body?: string }): Promise<AppResponse>;
  registerController(name: string, controllerClass: new () => ActionController.Base): void;
  drawRoutes(fn: (r: {
    get(path: string, options: string | { to: string; as?: string }): void;
    post(path: string, options: string | { to: string; as?: string }): void;
    put(path: string, options: string | { to: string; as?: string }): void;
    patch(path: string, options: string | { to: string; as?: string }): void;
    delete(path: string, options: string | { to: string; as?: string }): void;
    resources(name: string): void;
    root(to: string): void;
  }) => void): void;
  routes: any;
};

/** The runtime — access VFS, migrations, database tasks. */
declare const runtime: {
  vfs: {
    list(): Array<{ path: string; content: string; language: string; created_at: string; updated_at: string }>;
    read(path: string): { path: string; content: string; language: string } | null;
    write(path: string, content: string): void;
    delete(path: string): boolean;
    rename(oldPath: string, newPath: string): boolean;
    exists(path: string): boolean;
  };
  adapter: typeof adapter;
  registerMigration(proxy: { version: string; name: string; migration: () => any }): void;
  getMigrations(): Array<{ version: string; name: string }>;
  clearMigrations(): void;
  exec(command: string): Promise<CliResult>;
  executeCode(code: string): Promise<unknown>;
  executeSQL(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  getTables(): string[];
  getColumns(table: string): Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
  getTableData(table: string, limit?: number): { columns: string[]; rows: unknown[][] };
  getRowCount(table: string): number;
  exportDB(): Uint8Array;
  loadDB(data: Uint8Array): void;
  newProject(): void;
  reset(): void;
  dbSetup(): Promise<{ success: boolean; message: string; output?: string[] }>;
  dbReset(): Promise<{ success: boolean; message: string; output?: string[] }>;
  dbMigrate(): Promise<{ success: boolean; message: string; output?: string[] }>;
  dbRollback(steps?: number): Promise<{ success: boolean; message: string; output?: string[] }>;
  dbMigrateStatus(): Promise<Array<{ status: "up" | "down"; version: string; name: string }>>;
  dbSeed(code: string): Promise<{ success: boolean; message: string }>;
  dbDrop(): { success: boolean; message: string };
  dbSchema(): string;
  dbPrepare?(): Promise<{ success: boolean; message: string }>;
};
`;
