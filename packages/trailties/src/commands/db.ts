import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import {
  loadDatabaseConfig,
  connectAdapter,
  resolveEnv,
  type DatabaseConfig as RawConfig,
} from "../database.js";
import { discoverMigrations } from "../migration-loader.js";
import {
  DatabaseTasks,
  HashConfig,
  Migrator,
  DatabaseAlreadyExists,
  NoDatabaseError,
} from "@blazetrails/activerecord";
import type { DatabaseAdapter } from "@blazetrails/activerecord";

async function closeAdapter(adapter: DatabaseAdapter): Promise<void> {
  const maybeClose = (adapter as { close?: () => Promise<void> }).close;
  if (typeof maybeClose === "function") await maybeClose.call(adapter);
}

async function withAdapter(
  fn: (adapter: DatabaseAdapter, raw: RawConfig) => Promise<void>,
): Promise<void> {
  const config = await loadDatabaseConfig();
  const adapter = await connectAdapter(config);
  try {
    await fn(adapter, config);
  } finally {
    await closeAdapter(adapter);
  }
}

function migrationsDir(): string {
  return path.join(process.cwd(), "db", "migrations");
}

function databaseFromUrl(url: string, adapter?: string): string | undefined {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol;
    const isSqlite =
      adapter === "sqlite3" ||
      adapter === "sqlite" ||
      protocol === "sqlite:" ||
      protocol === "sqlite3:" ||
      protocol === "file:";
    if (isSqlite) {
      // SQLite URLs carry a filesystem path (often absolute). Preserve the
      // leading slash and host prefix if any: `sqlite3:///tmp/app.sqlite3`
      // -> `/tmp/app.sqlite3`; `sqlite3://./rel.sqlite3` -> `./rel.sqlite3`.
      const host = parsed.host;
      const pathname = decodeURIComponent(parsed.pathname);
      return host ? `${host}${pathname}` : pathname;
    }
    const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return name || undefined;
  } catch {
    return undefined;
  }
}

function inferAdapterFromUrl(url: string): string | undefined {
  try {
    switch (new URL(url).protocol) {
      case "postgres:":
      case "postgresql:":
        return "postgresql";
      case "mysql:":
      case "mysql2:":
      case "trilogy:":
        return "mysql2";
      case "sqlite:":
      case "sqlite3:":
      case "file:":
        return "sqlite3";
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

function toDbConfig(raw: RawConfig, envName: string = resolveEnv()): HashConfig {
  const normalized: Record<string, unknown> = { ...raw };
  if (!normalized.adapter) {
    if (typeof normalized.url === "string") {
      const inferred = inferAdapterFromUrl(normalized.url);
      if (inferred) normalized.adapter = inferred;
    }
    if (!normalized.adapter) normalized.adapter = "sqlite3";
  }
  if (!normalized.database && typeof normalized.url === "string") {
    const db = databaseFromUrl(normalized.url, normalized.adapter as string | undefined);
    if (db) normalized.database = db;
    try {
      const parsed = new URL(normalized.url);
      const protocol = parsed.protocol;
      const isSqlite =
        normalized.adapter === "sqlite3" ||
        normalized.adapter === "sqlite" ||
        protocol === "sqlite:" ||
        protocol === "sqlite3:" ||
        protocol === "file:";
      if (!isSqlite) {
        if (!normalized.host && parsed.hostname) normalized.host = parsed.hostname;
        if (!normalized.username && parsed.username) {
          normalized.username = decodeURIComponent(parsed.username);
        }
        if (!normalized.password && parsed.password) {
          normalized.password = decodeURIComponent(parsed.password);
        }
      }
    } catch {
      // leave unparsed url as-is; adapters will surface the error
    }
  }
  return new HashConfig(envName, "primary", normalized);
}

/**
 * Dump the schema to disk after a migration-writing task. Mirrors Rails'
 * `db:_dump`: gated on `DatabaseTasks.dumpSchemaAfterMigration`, and
 * delegates to `DatabaseTasks.dumpSchema(config)` so ts / js / sql formats
 * route through the same code path the standalone `trails db schema:dump`
 * subcommand uses.
 */
async function dumpSchemaAfterMigrate(adapter: DatabaseAdapter, raw: RawConfig): Promise<void> {
  if (!DatabaseTasks.dumpSchemaAfterMigration) return;
  const config = toDbConfig(raw);
  const previous = DatabaseTasks.migrationConnection();
  DatabaseTasks.setAdapter(adapter);
  try {
    await DatabaseTasks.dumpSchema(config);
  } finally {
    DatabaseTasks.setAdapter(previous);
  }
}

async function runMigrate(
  adapter: DatabaseAdapter,
  raw: RawConfig,
  targetVersion?: string,
): Promise<void> {
  const migrations = await discoverMigrations(migrationsDir());
  if (migrations.length === 0) {
    console.log("No migrations found.");
    return;
  }

  const migrator = new Migrator(adapter, migrations);
  await migrator.migrate(targetVersion ?? null);

  for (const line of migrator.output) console.log(line);

  const pending = await migrator.pendingMigrations();
  if (pending.length === 0) console.log("All migrations are up to date.");

  await dumpSchemaAfterMigrate(adapter, raw);
}

async function runRollback(adapter: DatabaseAdapter, raw: RawConfig, steps: number): Promise<void> {
  const migrations = await discoverMigrations(migrationsDir());
  if (migrations.length === 0) {
    console.log("No migrations found.");
    return;
  }

  const migrator = new Migrator(adapter, migrations);
  await migrator.rollback(steps);

  for (const line of migrator.output) console.log(line);

  await dumpSchemaAfterMigrate(adapter, raw);
}

async function runSeed(): Promise<void> {
  const seedCandidates = [
    path.join(process.cwd(), "db", "seeds.ts"),
    path.join(process.cwd(), "db", "seeds.js"),
  ];
  const seedFile = seedCandidates.find((f) => fs.existsSync(f));
  if (!seedFile) {
    console.log("No seeds file found at db/seeds.ts or db/seeds.js");
    return;
  }

  console.log("Running seeds...");
  await import(pathToFileURL(seedFile).href);
  console.log("Seeds completed.");
}

/** Strip credentials from a DB URL before we log it. */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    if (parsed.username && parsed.password === "***") {
      // Keep username visible so operators can still identify the connection.
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function displayNameFor(config: HashConfig, raw: RawConfig): string {
  return (
    config.database ??
    (raw.database as string | undefined) ??
    (typeof raw.url === "string" ? sanitizeUrl(raw.url) : undefined) ??
    `${config.adapter ?? "unknown"} database`
  );
}

async function runCreate(): Promise<void> {
  const raw = await loadDatabaseConfig();
  const config = toDbConfig(raw);
  const displayName = displayNameFor(config, raw);
  try {
    await DatabaseTasks.create(config);
    console.log(`Created database '${displayName}'`);
  } catch (error) {
    if (error instanceof DatabaseAlreadyExists) {
      console.error(`Database '${displayName}' already exists`);
      return;
    }
    throw error;
  }
}

async function runDrop(): Promise<void> {
  const raw = await loadDatabaseConfig();
  const config = toDbConfig(raw);
  const displayName = displayNameFor(config, raw);
  try {
    await DatabaseTasks.drop(config);
    console.log(`Dropped database '${displayName}'`);
  } catch (error) {
    if (error instanceof NoDatabaseError) {
      console.error(`Database '${displayName}' does not exist`);
      return;
    }
    throw error;
  }
}

export function dbCommand(): Command {
  const cmd = new Command("db");
  cmd.description("Database management commands");

  cmd
    .command("migrate")
    .description("Run pending migrations")
    .option("--version <version>", "Migrate to a specific version")
    .action(async (opts) => {
      await withAdapter((adapter, raw) => runMigrate(adapter, raw, opts.version));
    });

  cmd
    .command("rollback")
    .description("Rollback migrations")
    .option("--step <n>", "Number of migrations to rollback", "1")
    .action(async (opts) => {
      const step = Number(opts.step);
      if (!Number.isInteger(step) || step < 1) {
        console.error(`Invalid value for --step: "${opts.step}". Expected a positive integer.`);
        process.exitCode = 1;
        return;
      }
      await withAdapter((adapter, raw) => runRollback(adapter, raw, step));
    });

  cmd
    .command("forward")
    .description("Move the schema forward N migrations (inverse of rollback)")
    .option("--step <n>", "Number of migrations to apply", "1")
    .action(async (opts) => {
      const step = Number(opts.step);
      if (!Number.isInteger(step) || step < 1) {
        console.error(`Invalid value for --step: "${opts.step}". Expected a positive integer.`);
        process.exitCode = 1;
        return;
      }
      await withAdapter(async (adapter, raw) => {
        const migrations = await discoverMigrations(migrationsDir());
        if (migrations.length === 0) {
          console.log("No migrations found.");
          return;
        }
        const migrator = new Migrator(adapter, migrations);
        await migrator.forward(step);
        for (const line of migrator.output) console.log(line);
        await dumpSchemaAfterMigrate(adapter, raw);
      });
    });

  cmd
    .command("version")
    .description("Print the current schema version")
    .action(async () => {
      // Read only the schema_migrations table — don't discover or validate
      // migration files. Users should be able to ask for the current
      // version even when the migrations/ directory has a stale file.
      await withAdapter(async (adapter) => {
        const migrator = new Migrator(adapter, []);
        const version = await migrator.currentVersion();
        console.log(`Current version: ${version}`);
      });
    });

  cmd
    .command("abort_if_pending_migrations")
    .description("Exit with non-zero status if any migrations are pending")
    .action(async () => {
      await withAdapter(async (adapter) => {
        const migrations = await discoverMigrations(migrationsDir());
        if (migrations.length === 0) return;
        const migrator = new Migrator(adapter, migrations);
        const pending = await migrator.pendingMigrations();
        if (pending.length > 0) {
          // Match Rails' output format (from activerecord/lib/active_record/
          // railties/databases.rake), with the command name swapped for
          // trails:
          //   "You have N pending migration[s]:"
          //   "  %4d %s" per pending
          //   "Run `trails db migrate` to resolve this issue."
          // Rails prints `bin/rails db:migrate`; the trails CLI is
          // commander-style (`trails db migrate`, space-separated), not
          // rake-style colon namespaces.
          console.error(
            `You have ${pending.length} pending migration${pending.length === 1 ? "" : "s"}:`,
          );
          for (const m of pending) {
            // Rails prints `"  %4d %s" % [version, name]`, which emits the
            // version as an integer (no leading zeros). Normalize via BigInt
            // to match and to stay consistent with the rest of Migrator.
            const version = String(BigInt(m.version));
            console.error(`  ${version.padStart(4, " ")} ${m.name}`);
          }
          console.error("Run `trails db migrate` to resolve this issue.");
          process.exitCode = 1;
        }
      });
    });

  cmd
    .command("migrate:up")
    .description("Run a specific migration up (by version)")
    .requiredOption("--version <version>", "Migration version to run up")
    .action(async (opts) => {
      await withAdapter(async (adapter, raw) => {
        const migrations = await discoverMigrations(migrationsDir());
        const migrator = new Migrator(adapter, migrations);
        await migrator.run("up", opts.version);
        for (const line of migrator.output) console.log(line);
        await dumpSchemaAfterMigrate(adapter, raw);
      });
    });

  cmd
    .command("migrate:down")
    .description("Run a specific migration down (by version)")
    .requiredOption("--version <version>", "Migration version to run down")
    .action(async (opts) => {
      await withAdapter(async (adapter, raw) => {
        const migrations = await discoverMigrations(migrationsDir());
        const migrator = new Migrator(adapter, migrations);
        await migrator.run("down", opts.version);
        for (const line of migrator.output) console.log(line);
        await dumpSchemaAfterMigrate(adapter, raw);
      });
    });

  cmd
    .command("seed")
    .description("Run database seeds")
    .action(async () => {
      await withAdapter(async (adapter) => {
        const { Base } = await import("@blazetrails/activerecord");
        Base.adapter = adapter;
        await runSeed();
      });
    });

  cmd.command("create").description("Create the database").action(runCreate);

  cmd.command("drop").description("Drop the database").action(runDrop);

  cmd
    .command("migrate:status")
    .description("Show migration status")
    .action(async () => {
      await withAdapter(async (adapter) => {
        const migrations = await discoverMigrations(migrationsDir());
        if (migrations.length === 0) {
          console.log("No migrations found.");
          return;
        }

        const migrator = new Migrator(adapter, migrations);
        const statuses = await migrator.migrationsStatus();

        console.log("");
        console.log(" Status   Migration ID    Migration Name");
        console.log("--------------------------------------------------");
        for (const s of statuses) {
          const statusStr = s.status === "up" ? "  up  " : " down ";
          console.log(`${statusStr}   ${s.version.padEnd(16)}${s.name}`);
        }
        console.log("");
      });
    });

  cmd
    .command("migrate:redo")
    .description("Rollback and re-run the last migration")
    .option("--step <n>", "Number of migrations to redo", "1")
    .action(async (opts) => {
      const step = Number(opts.step);
      if (!Number.isInteger(step) || step < 1) {
        console.error(`Invalid value for --step: "${opts.step}". Expected a positive integer.`);
        process.exitCode = 1;
        return;
      }
      await withAdapter(async (adapter, raw) => {
        await runRollback(adapter, raw, step);
        await runMigrate(adapter, raw);
      });
    });

  cmd
    .command("reset")
    .description("Drop, create, migrate, and seed the database")
    .action(async () => {
      await runDrop();
      await runCreate();
      await withAdapter(async (adapter, raw) => {
        await runMigrate(adapter, raw);
        const { Base } = await import("@blazetrails/activerecord");
        Base.adapter = adapter;
        await runSeed();
      });
    });

  cmd
    .command("setup")
    .description("Create, migrate, and seed the database")
    .action(async () => {
      await runCreate();
      await withAdapter(async (adapter, raw) => {
        await runMigrate(adapter, raw);
        const { Base } = await import("@blazetrails/activerecord");
        Base.adapter = adapter;
        await runSeed();
      });
    });

  cmd
    .command("schema:dump")
    .description(
      "Dump the current database schema (format: DatabaseTasks.schemaFormat — ts/js/sql)",
    )
    .action(async () => {
      await withAdapter(async (adapter, raw) => {
        const config = toDbConfig(raw);
        const filename = DatabaseTasks.schemaDumpPath(config);
        const previous = DatabaseTasks.migrationConnection();
        DatabaseTasks.setAdapter(adapter);
        try {
          await DatabaseTasks.dumpSchema(config);
        } finally {
          DatabaseTasks.setAdapter(previous);
        }
        console.log(`Schema dumped to ${filename}`);
      });
    });

  cmd
    .command("schema:load")
    .description("Load the schema from db/schema.ts into the database")
    .action(async () => {
      const schemaCandidates = [
        path.join(process.cwd(), "db", "schema.ts"),
        path.join(process.cwd(), "db", "schema.js"),
      ];
      const schemaFile = schemaCandidates.find((f) => fs.existsSync(f));
      if (!schemaFile) {
        console.error("No schema file found at db/schema.ts or db/schema.js");
        process.exitCode = 1;
        return;
      }

      await withAdapter(async (adapter) => {
        const { MigrationContext } = await import("@blazetrails/activerecord");
        const ctx = new MigrationContext(adapter);
        let mod: any;
        try {
          mod = await import(pathToFileURL(schemaFile).href);
        } catch (error: any) {
          if (schemaFile.endsWith(".ts")) {
            const enhanced = new Error(
              `Failed to load schema file "${schemaFile}". ` +
                `Ensure a TypeScript loader (tsx, ts-node) is configured, ` +
                `or use a compiled db/schema.js instead.`,
            );
            (enhanced as any).cause = error;
            throw enhanced;
          }
          throw error;
        }
        const defineSchema = mod.default ?? mod;
        if (typeof defineSchema !== "function") {
          throw new Error(`Schema file must export a default function, got ${typeof defineSchema}`);
        }
        console.log("Loading schema...");
        await defineSchema(ctx);
        console.log("Schema loaded.");
      });
    });

  return cmd;
}
