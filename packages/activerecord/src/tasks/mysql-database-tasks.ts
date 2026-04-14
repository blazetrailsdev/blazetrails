/**
 * MySQLDatabaseTasks — MySQL/MariaDB-specific database lifecycle operations.
 *
 * Mirrors: ActiveRecord::Tasks::MySQLDatabaseTasks
 */

import * as fs from "node:fs";
import { spawnSync } from "node:child_process";
import type { DatabaseAdapter } from "../adapter.js";
import type { DatabaseConfig } from "../database-configurations/database-config.js";
import { DatabaseTasks } from "./database-tasks.js";

type ConfigHash = Record<string, unknown>;

interface UrlParts {
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  database?: string;
  socket?: string;
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
      socket: parsed.searchParams.get("socket") ?? undefined,
    };
  } catch {
    return {};
  }
}

export class MySQLDatabaseTasks {
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
    args.push("--database", this.requireDatabaseName());
    if (extraFlags) {
      args.unshift(...(Array.isArray(extraFlags) ? extraFlags : [extraFlags]));
    }
    const sqlBody = fs.readFileSync(filename, "utf8");
    const stdin = `SET FOREIGN_KEY_CHECKS = 0;\n${sqlBody}\nSET FOREIGN_KEY_CHECKS = 1;\n`;
    this.runCmd("mysql", args, "loading", stdin);
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

  private resolvedField(name: keyof UrlParts): string | undefined {
    const c = this.configurationHash;
    const fromConfig = c[name as string];
    if (fromConfig !== undefined && fromConfig !== null && fromConfig !== "") {
      return String(fromConfig);
    }
    const fromUrl = this.urlParts[name];
    return fromUrl !== undefined ? String(fromUrl) : undefined;
  }

  private prepareCommandOptions(): string[] {
    const args: string[] = [];
    const flagMap: Array<{ flag: string; key: string; fromUrl?: boolean }> = [
      { flag: "--host", key: "host", fromUrl: true },
      { flag: "--port", key: "port", fromUrl: true },
      { flag: "--socket", key: "socket", fromUrl: true },
      { flag: "--user", key: "username", fromUrl: true },
      { flag: "--password", key: "password", fromUrl: true },
      { flag: "--default-character-set", key: "encoding" },
      { flag: "--ssl-ca", key: "sslca" },
      { flag: "--ssl-cert", key: "sslcert" },
      { flag: "--ssl-capath", key: "sslcapath" },
      { flag: "--ssl-cipher", key: "sslcipher" },
      { flag: "--ssl-key", key: "sslkey" },
      { flag: "--ssl-mode", key: "ssl_mode" },
    ];
    for (const { flag, key, fromUrl } of flagMap) {
      const value = fromUrl
        ? this.resolvedField(key as keyof UrlParts)
        : (this.configurationHash[key] as string | number | undefined);
      if (value !== undefined && value !== null && value !== "") {
        args.push(`${flag}=${String(value)}`);
      }
    }
    return args;
  }

  private async withAdmin<T>(fn: (admin: DatabaseAdapter) => Promise<T>): Promise<T> {
    const { Mysql2Adapter } = await import("../adapters/mysql2-adapter.js");
    const adapter = new Mysql2Adapter({
      host: this.resolvedField("host") ?? "localhost",
      port: Number(this.resolvedField("port") ?? 3306),
      user: this.resolvedField("username"),
      password: this.resolvedField("password"),
    });
    try {
      return await fn(adapter);
    } finally {
      const close = (adapter as unknown as { close?: () => Promise<void> }).close;
      if (typeof close === "function") await close.call(adapter);
    }
  }

  private runCmd(cmd: string, args: string[], action: string, stdin?: string): void {
    const spawnOpts: Parameters<typeof spawnSync>[2] = { encoding: "utf8" };
    if (stdin !== undefined) spawnOpts.input = stdin;
    const result = spawnSync(cmd, args, spawnOpts);
    if (result.error || result.status !== 0 || result.signal) {
      const details: string[] = [];
      if (result.error) details.push(`Error: ${result.error.message}`);
      if (result.status !== null && result.status !== 0) {
        details.push(`Exit status: ${result.status}`);
      }
      if (result.signal) details.push(`Signal: ${result.signal}`);
      if (result.stderr) details.push(`stderr:\n${String(result.stderr).trimEnd()}`);
      if (result.stdout) details.push(`stdout:\n${String(result.stdout).trimEnd()}`);
      throw new Error(
        `failed to execute: \`${cmd}\`\n` +
          (details.length ? `${details.join("\n\n")}\n\n` : "") +
          `Make sure \`${cmd}\` is installed in your PATH and has proper permissions.\n` +
          `(action: ${action})`,
      );
    }
  }

  private requireDatabaseName(): string {
    const name = this.dbConfig.database ?? this.urlParts.database;
    if (!name) throw new Error("MySQL configuration missing 'database'");
    return name;
  }

  private escapeIdent(value: string): string {
    return value.replace(/`/g, "``");
  }
}
