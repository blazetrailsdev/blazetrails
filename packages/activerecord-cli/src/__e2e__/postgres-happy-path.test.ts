// Postgres E2E suite — mirrors sqlite-happy-path.test.ts. Set PG_TEST_URL to run.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { run } from "../cli.js";
import { DatabaseTasks } from "@blazetrails/activerecord";

const PG_URL = process.env.PG_TEST_URL;

const MIGRATION_BODY = `\
export default {
  async up() {
    await this.connection.createTable("users", (t) => {
      t.string("name");
    });
  },
  async down() {
    await this.connection.dropTable("users");
  },
};
`;

/** Swap the database name in a postgres URL, preserving credentials/host/port. */
function swapDbName(url: string, dbName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

describe.skipIf(!PG_URL)("postgres-happy-path E2E", () => {
  let tmpDir: string;
  let dbName: string;
  let dbUrl: string;
  let origTrailsEnv: string | undefined;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ar-cli-e2e-pg-"));
    // Unique DB per run so parallel/consecutive runs don't collide.
    dbName = `ar_cli_e2e_${process.hrtime.bigint()}`;
    dbUrl = swapDbName(PG_URL!, dbName);
    origTrailsEnv = process.env.TRAILS_ENV;
    process.env.TRAILS_ENV = "development";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (origTrailsEnv === undefined) {
      delete process.env.TRAILS_ENV;
    } else {
      process.env.TRAILS_ENV = origTrailsEnv;
    }
    // Best-effort drop — ignore errors if create never succeeded.
    try {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      await run(["db:drop"], tmpDir);
    } catch {
      // ignore
    }
    vi.restoreAllMocks();
    DatabaseTasks.databaseConfiguration = null;
    (DatabaseTasks as unknown as { _root: string | null })._root = null;
    DatabaseTasks.registerMigrations([]);
    DatabaseTasks.seedLoader = null;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("init → db:create → generate:migration → db:migrate → db:version → db:migrate:status", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // 1. ar init --driver pg — scaffolds config/database.ts (sqlite default), db/migrate/, etc.
    const initCode = await run(["init", "--driver", "pg"], tmpDir);
    expect(initCode, "ar init should exit 0").toBe(0);

    // 2. Overwrite config/database.ts to point at our unique PG test DB.
    const pgConfig = `const config = {
  development: { adapter: "postgresql", url: "${dbUrl}" },
  test:        { adapter: "postgresql", url: "${dbUrl}" },
  production:  { adapter: "postgresql", url: "${dbUrl}" },
};
export default config;
`;
    await writeFile(join(tmpDir, "config", "database.ts"), pgConfig, "utf8");

    // 3. ar db:create — creates the unique PG database.
    const createCode = await run(["db:create"], tmpDir);
    expect(createCode, "ar db:create should exit 0").toBe(0);

    // 4. ar generate:migration AddUsersTable — emits a stub migration file.
    const genCode = await run(["generate:migration", "AddUsersTable"], tmpDir);
    expect(genCode, "ar generate:migration should exit 0").toBe(0);

    const migrateDir = join(tmpDir, "db", "migrate");
    const entries = await readdir(migrateDir);
    const migrationEntry = entries.find((e) => e.endsWith("_add_users_table.ts"));
    expect(migrationEntry, "generated migration file should exist").toBeTruthy();

    const migrationPath = join(migrateDir, migrationEntry!);
    const version = migrationEntry!.split("_")[0]!;

    // 5. Patch the migration with a real table-creating body.
    await writeFile(migrationPath, MIGRATION_BODY, "utf8");

    // 6. ar db:migrate — applies the migration, stamps schema_migrations.
    const migrateCode = await run(["db:migrate"], tmpDir);
    expect(migrateCode, "ar db:migrate should exit 0").toBe(0);

    // 7. ar db:version — should report the applied version.
    const versionLines: string[] = [];
    vi.spyOn(console, "log").mockImplementation(
      (...args) => void versionLines.push(args.map(String).join(" ")),
    );
    const versionCode = await run(["db:version"], tmpDir);
    expect(versionCode, "ar db:version should exit 0").toBe(0);
    expect(versionLines.join("\n")).toContain(`Current version: ${version}`);

    // 8. ar db:migrate:status — should show the migration as "up".
    const statusLines: string[] = [];
    vi.spyOn(console, "log").mockImplementation(
      (...args) => void statusLines.push(args.map(String).join(" ")),
    );
    const statusCode = await run(["db:migrate:status"], tmpDir);
    expect(statusCode, "ar db:migrate:status should exit 0").toBe(0);
    const statusText = statusLines.join("\n");
    expect(statusText).toContain("up");
    expect(statusText).toContain(version);
  });
});
