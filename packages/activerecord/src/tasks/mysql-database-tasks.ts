/**
 * MySQLDatabaseTasks — MySQL/MariaDB-specific database lifecycle operations.
 *
 * Mirrors: ActiveRecord::Tasks::MySQLDatabaseTasks
 */

import { spawnSync } from "node:child_process";
import type { DatabaseAdapter } from "../adapter.js";
import type { DatabaseConfig } from "../database-configurations/database-config.js";
import { DatabaseTasks } from "./database-tasks.js";

type ConfigHash = Record<string, unknown>;

export class MySQLDatabaseTasks {
  private readonly dbConfig: DatabaseConfig;
  private readonly configurationHash: ConfigHash;

  static usingDatabaseConfigurations(): boolean {
    return true;
  }

  constructor(dbConfig: DatabaseConfig) {
    this.dbConfig = dbConfig;
    this.configurationHash = { ...dbConfig.configuration };
  }

  async create(): Promise<void> {
    const opts = this.creationOptions();
    const charset = opts.charset ? ` CHARACTER SET \`${this.escapeIdent(opts.charset)}\`` : "";
    const collation = opts.collation ? ` COLLATE \`${this.escapeIdent(opts.collation)}\`` : "";
    const sql = `CREATE DATABASE \`${this.escapeIdent(this.requireDatabaseName())}\`${charset}${collation}`;
    await this.withAdmin((admin) => admin.executeMutation(sql));
  }

  async drop(): Promise<void> {
    await this.withAdmin((admin) =>
      admin.executeMutation(
        `DROP DATABASE IF EXISTS \`${this.escapeIdent(this.requireDatabaseName())}\``,
      ),
    );
  }

  async purge(): Promise<void> {
    await this.drop();
    await this.create();
  }

  charset(): string {
    return String(this.configurationHash.encoding ?? "utf8mb4");
  }

  collation(): string | null {
    return (this.configurationHash.collation as string) ?? null;
  }

  structureDump(filename: string, extraFlags?: string | string[] | null): void {
    const args = this.prepareCommandOptions();
    args.push("--result-file", filename, "--no-data", "--routines", "--skip-comments");
    args.push(this.requireDatabaseName());
    if (extraFlags) {
      args.unshift(...(Array.isArray(extraFlags) ? extraFlags : [extraFlags]));
    }
    this.runCmd("mysqldump", args, "dumping");
  }

  structureLoad(filename: string, extraFlags?: string | string[] | null): void {
    const args = this.prepareCommandOptions();
    args.push(
      "--execute",
      `SET FOREIGN_KEY_CHECKS = 0; SOURCE ${filename}; SET FOREIGN_KEY_CHECKS = 1`,
      "--database",
      this.requireDatabaseName(),
    );
    if (extraFlags) {
      args.unshift(...(Array.isArray(extraFlags) ? extraFlags : [extraFlags]));
    }
    this.runCmd("mysql", args, "loading");
  }

  static register(): void {
    const handler = {
      create: async (config: DatabaseConfig) => new MySQLDatabaseTasks(config).create(),
      drop: async (config: DatabaseConfig) => new MySQLDatabaseTasks(config).drop(),
      purge: async (config: DatabaseConfig) => new MySQLDatabaseTasks(config).purge(),
      charset: async (config: DatabaseConfig) => new MySQLDatabaseTasks(config).charset(),
      collation: async (config: DatabaseConfig) => new MySQLDatabaseTasks(config).collation(),
      structureDump: async (
        config: DatabaseConfig,
        filename: string,
        flags?: string | string[] | null,
      ) => new MySQLDatabaseTasks(config).structureDump(filename, flags),
      structureLoad: async (
        config: DatabaseConfig,
        filename: string,
        flags?: string | string[] | null,
      ) => new MySQLDatabaseTasks(config).structureLoad(filename, flags),
    };
    DatabaseTasks.registerTask(/mysql/, handler);
    DatabaseTasks.registerTask(/trilogy/, handler);
  }

  private creationOptions(): { charset?: string; collation?: string } {
    const options: { charset?: string; collation?: string } = {};
    if (this.configurationHash.encoding !== undefined) {
      options.charset = String(this.configurationHash.encoding);
    }
    if (this.configurationHash.collation !== undefined) {
      options.collation = String(this.configurationHash.collation);
    }
    return options;
  }

  private prepareCommandOptions(): string[] {
    const mapping: Record<string, string> = {
      host: "--host",
      port: "--port",
      socket: "--socket",
      username: "--user",
      password: "--password",
      encoding: "--default-character-set",
      sslca: "--ssl-ca",
      sslcert: "--ssl-cert",
      sslcapath: "--ssl-capath",
      sslcipher: "--ssl-cipher",
      sslkey: "--ssl-key",
      ssl_mode: "--ssl-mode",
    };
    const args: string[] = [];
    for (const [opt, flag] of Object.entries(mapping)) {
      const value = this.configurationHash[opt];
      if (value !== undefined && value !== null && value !== "") {
        args.push(`${flag}=${String(value)}`);
      }
    }
    return args;
  }

  private async withAdmin<T>(fn: (admin: DatabaseAdapter) => Promise<T>): Promise<T> {
    const { Mysql2Adapter } = await import("../adapters/mysql2-adapter.js");
    const c = this.configurationHash;
    const adapter = c.url
      ? new Mysql2Adapter(String(c.url))
      : new Mysql2Adapter({
          host: (c.host as string) ?? "localhost",
          port: (c.port as number) ?? 3306,
          user: c.username as string | undefined,
          password: c.password as string | undefined,
        });
    try {
      return await fn(adapter);
    } finally {
      const close = (adapter as unknown as { close?: () => Promise<void> }).close;
      if (typeof close === "function") await close.call(adapter);
    }
  }

  private runCmd(cmd: string, args: string[], action: string): void {
    const result = spawnSync(cmd, args, { encoding: "utf8" });
    if (result.status !== 0) {
      const msg =
        `failed to execute: \`${cmd}\`\n` +
        `Please check the output above for any errors and make sure that ` +
        `\`${cmd}\` is installed in your PATH and has proper permissions.\n\n` +
        `(action: ${action}, stderr: ${result.stderr ?? ""})`;
      throw new Error(msg);
    }
  }

  private requireDatabaseName(): string {
    const name = this.dbConfig.database;
    if (!name) throw new Error("MySQL configuration missing 'database'");
    return name;
  }

  private escapeIdent(value: string): string {
    return value.replace(/`/g, "``");
  }
}
