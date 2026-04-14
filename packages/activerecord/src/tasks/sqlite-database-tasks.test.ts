import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { SQLiteDatabaseTasks } from "./sqlite-database-tasks.js";
import { DatabaseTasks } from "./database-tasks.js";
import { HashConfig } from "../database-configurations/hash-config.js";
import { DatabaseAlreadyExists, NoDatabaseError } from "../errors.js";

function tmpDbPath(): string {
  return path.join(os.tmpdir(), `trails-sqlite-test-${process.pid}-${randomUUID()}.sqlite3`);
}

describe("SQLiteDatabaseTasks", () => {
  const created: string[] = [];

  afterEach(() => {
    for (const file of created) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
    created.length = 0;
  });

  it("test_db_create_creates_file", async () => {
    const dbPath = tmpDbPath();
    created.push(dbPath);
    const config = new HashConfig("development", "primary", {
      adapter: "sqlite3",
      database: dbPath,
    });
    await new SQLiteDatabaseTasks(config).create();
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("test_db_create_when_file_exists_raises", async () => {
    const dbPath = tmpDbPath();
    created.push(dbPath);
    fs.writeFileSync(dbPath, "");
    const config = new HashConfig("development", "primary", {
      adapter: "sqlite3",
      database: dbPath,
    });
    await expect(new SQLiteDatabaseTasks(config).create()).rejects.toBeInstanceOf(
      DatabaseAlreadyExists,
    );
  });

  it("test_db_drop_removes_file", async () => {
    const dbPath = tmpDbPath();
    created.push(dbPath);
    fs.writeFileSync(dbPath, "");
    const config = new HashConfig("development", "primary", {
      adapter: "sqlite3",
      database: dbPath,
    });
    await new SQLiteDatabaseTasks(config).drop();
    expect(fs.existsSync(dbPath)).toBe(false);
  });

  it("test_db_drop_missing_raises_no_database_error", async () => {
    const dbPath = tmpDbPath();
    const config = new HashConfig("development", "primary", {
      adapter: "sqlite3",
      database: dbPath,
    });
    await expect(new SQLiteDatabaseTasks(config).drop()).rejects.toBeInstanceOf(NoDatabaseError);
  });

  it("test_charset_returns_utf8", () => {
    const config = new HashConfig("development", "primary", {
      adapter: "sqlite3",
      database: ":memory:",
    });
    expect(new SQLiteDatabaseTasks(config).charset()).toBe("UTF-8");
  });

  it("test_registers_with_database_tasks", () => {
    DatabaseTasks.clearRegisteredTasks();
    SQLiteDatabaseTasks.register();
    expect(DatabaseTasks.resolveTask("sqlite3")).toBeDefined();
  });
});
