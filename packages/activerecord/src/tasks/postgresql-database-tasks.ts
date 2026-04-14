/**
 * PostgreSQLDatabaseTasks — PostgreSQL-specific database lifecycle operations.
 *
 * Mirrors: ActiveRecord::Tasks::PostgreSQLDatabaseTasks
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import type { DatabaseAdapter } from "../adapter.js";
import type { DatabaseConfig } from "../database-configurations/database-config.js";
import { DatabaseTasks } from "./database-tasks.js";

const DEFAULT_ENCODING = process.env.CHARSET ?? "utf8";
const ON_ERROR_STOP_1 = "ON_ERROR_STOP=1";
const SQL_COMMENT_BEGIN = "--";

type ConfigHash = Record<string, unknown>;

export class PostgreSQLDatabaseTasks {
  private readonly dbConfig: DatabaseConfig;
  private readonly configurationHash: ConfigHash;

  static usingDatabaseConfigurations(): boolean {
    return true;
  }

  constructor(dbConfig: DatabaseConfig) {
    this.dbConfig = dbConfig;
    this.configurationHash = { ...dbConfig.configuration };
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
    if (this.dbConfig.host) env.PGHOST = this.dbConfig.host;
    if (c.port !== undefined) env.PGPORT = String(c.port);
    if (c.password !== undefined) env.PGPASSWORD = String(c.password);
    if (c.username !== undefined) env.PGUSER = String(c.username);
    if (c.sslmode !== undefined) env.PGSSLMODE = String(c.sslmode);
    if (c.sslcert !== undefined) env.PGSSLCERT = String(c.sslcert);
    if (c.sslkey !== undefined) env.PGSSLKEY = String(c.sslkey);
    if (c.sslrootcert !== undefined) env.PGSSLROOTCERT = String(c.sslrootcert);
    return env;
  }

  private runCmd(cmd: string, args: string[], action: string): void {
    const result = spawnSync(cmd, args, { env: this.psqlEnv(), encoding: "utf8" });
    if (result.status !== 0) {
      const msg =
        `failed to execute:\n${cmd} ${args.join(" ")}\n\n` +
        `Please check the output above for any errors and make sure that ` +
        `\`${cmd}\` is installed in your PATH and has proper permissions.\n\n` +
        `(action: ${action})`;
      throw new Error(msg);
    }
  }

  private removeSqlHeaderComments(filename: string): void {
    const contents = fs.readFileSync(filename, "utf8");
    const lines = contents.split("\n");
    let i = 0;
    while (i < lines.length && (lines[i].startsWith(SQL_COMMENT_BEGIN) || lines[i].trim() === "")) {
      i++;
    }
    const tmp = path.join(os.tmpdir(), `uncommented_structure_${process.pid}.sql`);
    fs.writeFileSync(tmp, lines.slice(i).join("\n"));
    fs.copyFileSync(tmp, filename);
    fs.unlinkSync(tmp);
  }

  private requireDatabaseName(): string {
    const name = this.dbConfig.database;
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
