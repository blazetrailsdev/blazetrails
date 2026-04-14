/**
 * SQLiteDatabaseTasks — SQLite-specific database lifecycle operations.
 *
 * Mirrors: ActiveRecord::Tasks::SQLiteDatabaseTasks
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
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

  structureDump(filename: string, extraFlags?: string | string[] | null): void {
    const args: string[] = [];
    if (extraFlags) {
      args.push(...(Array.isArray(extraFlags) ? extraFlags : [extraFlags]));
    }
    args.push(this.resolveDbPath());
    args.push(".schema --nosys");
    this.runCmd("sqlite3", args, filename);
  }

  structureLoad(filename: string, extraFlags?: string | string[] | null): void {
    const args: string[] = [];
    if (extraFlags) {
      args.push(...(Array.isArray(extraFlags) ? extraFlags : [extraFlags]));
    }
    args.push(this.resolveDbPath());
    const sql = fs.readFileSync(filename, "utf8");
    const result = spawnSync("sqlite3", args, { input: sql, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`failed to execute:\nsqlite3 ${args.join(" ")}\n\n${result.stderr ?? ""}`);
    }
  }

  private resolveDbPath(): string {
    const database = this.dbConfig.database;
    if (!database) {
      throw new Error("SQLite database configuration missing 'database' path");
    }
    if (database === ":memory:" || path.isAbsolute(database)) return database;
    return path.join(this.root, database);
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

  private runCmd(cmd: string, args: string[], outFile: string): void {
    const result = spawnSync(cmd, args, { encoding: "utf8" });
    if (result.status !== 0) {
      const msg =
        `failed to execute:\n${cmd} ${args.join(" ")}\n\n` +
        `Please check the output above for any errors and make sure that ` +
        `\`${cmd}\` is installed in your PATH and has proper permissions.\n\n`;
      throw new Error(msg);
    }
    fs.writeFileSync(outFile, result.stdout ?? "");
  }
}
