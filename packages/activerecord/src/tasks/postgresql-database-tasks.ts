/**
 * PostgreSQLDatabaseTasks — PostgreSQL-specific database lifecycle operations.
 *
 * Mirrors: ActiveRecord::Tasks::PostgreSQLDatabaseTasks
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
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

  async create(_connectionAlreadyEstablished = false): Promise<void> {
    const dbName = this.requireDatabaseName();
    const encoding = String(this.configurationHash.encoding ?? DEFAULT_ENCODING);
    const sql = `CREATE DATABASE "${dbName}" ENCODING '${encoding}'`;
    await this.runOnSystemDb(sql);
  }

  async drop(): Promise<void> {
    const dbName = this.requireDatabaseName();
    await this.runOnSystemDb(`DROP DATABASE IF EXISTS "${dbName}"`);
  }

  charset(): string {
    return String(this.configurationHash.encoding ?? DEFAULT_ENCODING);
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
    });
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

  private async runOnSystemDb(sql: string): Promise<void> {
    const args = ["--dbname", "postgres", "--command", sql];
    const result = spawnSync("psql", args, { env: this.psqlEnv(), encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`failed to execute: psql ${args.join(" ")}\n\n${result.stderr ?? ""}`);
    }
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
}
