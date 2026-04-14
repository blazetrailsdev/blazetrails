/**
 * PostgreSQLDatabaseTasks — PostgreSQL-specific database lifecycle operations.
 *
 * Mirrors: ActiveRecord::Tasks::PostgreSQLDatabaseTasks
 */

import {
  getFs,
  getOs,
  getPath,
  getChildProcess,
  type SpawnSyncResult,
} from "@blazetrails/activesupport";
import type { DatabaseAdapter } from "../adapter.js";
import type { DatabaseConfig } from "../database-configurations/database-config.js";
import { DatabaseTasks } from "./database-tasks.js";

const DEFAULT_ENCODING = process.env.CHARSET ?? "utf8";
const ON_ERROR_STOP_1 = "ON_ERROR_STOP=1";
const SQL_COMMENT_BEGIN = "--";

type ConfigHash = Record<string, unknown>;

interface UrlParts {
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  database?: string;
  sslmode?: string;
  sslcert?: string;
  sslkey?: string;
  sslrootcert?: string;
}

function parseDbUrl(url: string | undefined): UrlParts {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return {
      host: parsed.hostname || undefined,
      port: parsed.port || undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      database: database || undefined,
      sslmode: parsed.searchParams.get("sslmode") ?? undefined,
      sslcert: parsed.searchParams.get("sslcert") ?? undefined,
      sslkey: parsed.searchParams.get("sslkey") ?? undefined,
      sslrootcert: parsed.searchParams.get("sslrootcert") ?? undefined,
    };
  } catch {
    return {};
  }
}

export class PostgreSQLDatabaseTasks {
  private readonly dbConfig: DatabaseConfig;
  private readonly configurationHash: ConfigHash;
  private readonly urlParts: UrlParts;

  static usingDatabaseConfigurations(): boolean {
    return true;
  }

  constructor(dbConfig: DatabaseConfig) {
    this.dbConfig = dbConfig;
    this.configurationHash = { ...dbConfig.configuration };
    this.urlParts = parseDbUrl(this.configurationHash.url as string | undefined);
  }

  async create(connectionAlreadyEstablished = false): Promise<void> {
    const dbName = this.requireDatabaseName();
    const encoding = this.encoding();
    const sql = `CREATE DATABASE "${this.escapeIdent(dbName)}" ENCODING '${this.escapeSingle(encoding)}'`;
    const admin = await this.connectAdmin();
    try {
      await admin.executeMutation(sql);
    } finally {
      await this.closeAdapter(admin);
    }
    void connectionAlreadyEstablished;
  }

  async drop(): Promise<void> {
    const dbName = this.requireDatabaseName();
    const admin = await this.connectAdmin();
    try {
      await admin.executeMutation(`DROP DATABASE IF EXISTS "${this.escapeIdent(dbName)}"`);
    } finally {
      await this.closeAdapter(admin);
    }
  }

  charset(): string {
    return this.encoding();
  }

  collation(): string | null {
    return (this.configurationHash.collation as string) ?? null;
  }

  async purge(): Promise<void> {
    await this.drop();
    await this.create(true);
  }

  structureDump(filename: string, extraFlags?: string | string[] | null): void {
    const args = ["--schema-only", "--no-privileges", "--no-owner", "--file", filename];
    if (extraFlags) {
      args.push(...(Array.isArray(extraFlags) ? extraFlags : [extraFlags]));
    }
    args.push(this.requireDatabaseName());
    this.runCmd("pg_dump", args, "dumping");
    this.removeSqlHeaderComments(filename);
  }

  structureLoad(filename: string, extraFlags?: string | string[] | null): void {
    const args = [
      "--set",
      ON_ERROR_STOP_1,
      "--quiet",
      "--no-psqlrc",
      "--output",
      "/dev/null",
      "--file",
      filename,
    ];
    if (extraFlags) {
      args.push(...(Array.isArray(extraFlags) ? extraFlags : [extraFlags]));
    }
    args.push(this.requireDatabaseName());
    this.runCmd("psql", args, "loading");
  }

  static register(): void {
    DatabaseTasks.registerTask(/postgres/, {
      create: async (config) => new PostgreSQLDatabaseTasks(config).create(),
      drop: async (config) => new PostgreSQLDatabaseTasks(config).drop(),
      purge: async (config) => new PostgreSQLDatabaseTasks(config).purge(),
      charset: async (config) => new PostgreSQLDatabaseTasks(config).charset(),
      collation: async (config) => new PostgreSQLDatabaseTasks(config).collation(),
      structureDump: async (config, filename, flags) =>
        new PostgreSQLDatabaseTasks(config).structureDump(filename, flags),
      structureLoad: async (config, filename, flags) =>
        new PostgreSQLDatabaseTasks(config).structureLoad(filename, flags),
    });
  }

  private encoding(): string {
    return String(this.configurationHash.encoding ?? DEFAULT_ENCODING);
  }

  private async connectAdmin(): Promise<DatabaseAdapter> {
    const { PostgreSQLAdapter } = await import("../adapters/postgresql-adapter.js");
    const c = this.configurationHash;
    if (c.url) {
      const parsed = new URL(String(c.url));
      parsed.pathname = "/postgres";
      return new PostgreSQLAdapter(parsed.toString());
    }
    return new PostgreSQLAdapter({
      host: (c.host as string) ?? "localhost",
      port: (c.port as number) ?? 5432,
      database: "postgres",
      user: c.username as string | undefined,
      password: c.password as string | undefined,
    });
  }

  private async closeAdapter(adapter: DatabaseAdapter): Promise<void> {
    const maybeClose = (adapter as { close?: () => Promise<void> }).close;
    if (typeof maybeClose === "function") {
      await maybeClose.call(adapter);
    }
  }

  private psqlEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    const c = this.configurationHash;
    const host = this.dbConfig.host ?? this.urlParts.host;
    const port = c.port ?? this.urlParts.port;
    const password = c.password ?? this.urlParts.password;
    const username = c.username ?? this.urlParts.username;
    if (host) env.PGHOST = String(host);
    if (port !== undefined) env.PGPORT = String(port);
    if (password !== undefined) env.PGPASSWORD = String(password);
    if (username !== undefined) env.PGUSER = String(username);
    const sslmode = c.sslmode ?? this.urlParts.sslmode;
    const sslcert = c.sslcert ?? this.urlParts.sslcert;
    const sslkey = c.sslkey ?? this.urlParts.sslkey;
    const sslrootcert = c.sslrootcert ?? this.urlParts.sslrootcert;
    if (sslmode !== undefined) env.PGSSLMODE = String(sslmode);
    if (sslcert !== undefined) env.PGSSLCERT = String(sslcert);
    if (sslkey !== undefined) env.PGSSLKEY = String(sslkey);
    if (sslrootcert !== undefined) env.PGSSLROOTCERT = String(sslrootcert);
    return env;
  }

  private runCmd(cmd: string, args: string[], action: string): void {
    const result = getChildProcess().spawnSync(cmd, args, {
      env: this.psqlEnv(),
      encoding: "utf8",
    });
    if (result.error || result.status !== 0 || result.signal) {
      throw new Error(formatCmdError(cmd, args, result, action));
    }
  }

  private removeSqlHeaderComments(filename: string): void {
    const fs = getFs();
    const path = getPath();
    const os = getOs();
    const contents = fs.readFileSync(filename, "utf8");
    const lines = contents.split("\n");
    let i = 0;
    while (i < lines.length && (lines[i].startsWith(SQL_COMMENT_BEGIN) || lines[i].trim() === "")) {
      i++;
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "uncommented_structure_"));
    const tmp = path.join(tmpDir, "structure.sql");
    try {
      fs.writeFileSync(tmp, lines.slice(i).join("\n"));
      fs.copyFileSync(tmp, filename);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private requireDatabaseName(): string {
    const name = this.dbConfig.database ?? this.urlParts.database;
    if (!name) throw new Error("PostgreSQL configuration missing 'database'");
    return name;
  }

  private escapeIdent(value: string): string {
    return value.replace(/"/g, '""');
  }

  private escapeSingle(value: string): string {
    return value.replace(/'/g, "''");
  }
}

function formatCmdError(
  cmd: string,
  args: string[],
  result: SpawnSyncResult,
  action: string,
): string {
  const details: string[] = [];
  if (result.error) details.push(`Error: ${result.error.message}`);
  if (result.status !== null && result.status !== 0) {
    details.push(`Exit status: ${result.status}`);
  }
  if (result.signal) details.push(`Signal: ${result.signal}`);
  if (result.stderr) details.push(`stderr:\n${String(result.stderr).trimEnd()}`);
  if (result.stdout) details.push(`stdout:\n${String(result.stdout).trimEnd()}`);
  return (
    `failed to execute:\n${cmd} ${args.join(" ")}\n\n` +
    (details.length ? `${details.join("\n\n")}\n\n` : "") +
    `Make sure \`${cmd}\` is installed in your PATH and has proper permissions.\n` +
    `(action: ${action})`
  );
}
