import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadDatabaseConfig, connectAdapter } from "../database.js";
import { discoverMigrations } from "../migration-loader.js";
import { Migrator } from "@rails-ts/activerecord";

export function dbCommand(): Command {
  const cmd = new Command("db");
  cmd.description("Database management commands");

  cmd
    .command("migrate")
    .description("Run pending migrations")
    .option("--version <version>", "Migrate to a specific version")
    .action(async (opts) => {
      const config = await loadDatabaseConfig();
      const adapter = await connectAdapter(config);
      const migrationsDir = path.join(process.cwd(), "db", "migrations");
      const migrations = await discoverMigrations(migrationsDir);

      if (migrations.length === 0) {
        console.log("No migrations found.");
        return;
      }

      const migrator = new Migrator(adapter, migrations);
      await migrator.migrate(opts.version ?? null);

      for (const line of migrator.output) {
        console.log(line);
      }

      const pending = await migrator.pendingMigrations();
      if (pending.length === 0) {
        console.log("All migrations are up to date.");
      }
    });

  cmd
    .command("rollback")
    .description("Rollback migrations")
    .option("--step <n>", "Number of migrations to rollback", "1")
    .action(async (opts) => {
      const config = await loadDatabaseConfig();
      const adapter = await connectAdapter(config);
      const migrationsDir = path.join(process.cwd(), "db", "migrations");
      const migrations = await discoverMigrations(migrationsDir);

      if (migrations.length === 0) {
        console.log("No migrations found.");
        return;
      }

      const migrator = new Migrator(adapter, migrations);
      await migrator.rollback(parseInt(opts.step, 10));

      for (const line of migrator.output) {
        console.log(line);
      }
    });

  cmd
    .command("seed")
    .description("Run database seeds")
    .action(async () => {
      const seedFile = path.join(process.cwd(), "db", "seeds.ts");
      if (!fs.existsSync(seedFile)) {
        console.log("No seeds file found at db/seeds.ts");
        return;
      }

      const config = await loadDatabaseConfig();
      await connectAdapter(config);
      console.log("Running seeds...");
      await import(seedFile);
      console.log("Seeds completed.");
    });

  cmd
    .command("create")
    .description("Create the database")
    .action(async () => {
      const config = await loadDatabaseConfig();
      const adapter = config.adapter ?? "sqlite3";

      if (adapter === "sqlite3" || adapter === "sqlite") {
        const dbPath = config.database;
        if (dbPath && dbPath !== ":memory:") {
          fs.mkdirSync(path.dirname(dbPath), { recursive: true });
          if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, "");
          }
          console.log(`Created database '${dbPath}'`);
        }
      } else {
        // For pg/mysql: connect to system database and CREATE DATABASE
        const dbName = config.database;
        const systemConfig = {
          ...config,
          database: adapter === "mysql2" || adapter === "mysql" ? undefined : "postgres",
        };
        const systemAdapter = await connectAdapter(systemConfig);
        await systemAdapter.executeMutation(`CREATE DATABASE "${dbName}"`);
        console.log(`Created database '${dbName}'`);
      }
    });

  cmd
    .command("drop")
    .description("Drop the database")
    .action(async () => {
      const config = await loadDatabaseConfig();
      const adapter = config.adapter ?? "sqlite3";

      if (adapter === "sqlite3" || adapter === "sqlite") {
        const dbPath = config.database;
        if (dbPath && dbPath !== ":memory:" && fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
          console.log(`Dropped database '${dbPath}'`);
        }
      } else {
        const dbName = config.database;
        const systemConfig = {
          ...config,
          database: adapter === "mysql2" || adapter === "mysql" ? undefined : "postgres",
        };
        const systemAdapter = await connectAdapter(systemConfig);
        await systemAdapter.executeMutation(`DROP DATABASE IF EXISTS "${dbName}"`);
        console.log(`Dropped database '${dbName}'`);
      }
    });

  cmd
    .command("migrate:status")
    .description("Show migration status")
    .action(async () => {
      const config = await loadDatabaseConfig();
      const adapter = await connectAdapter(config);
      const migrationsDir = path.join(process.cwd(), "db", "migrations");
      const migrations = await discoverMigrations(migrationsDir);

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

  return cmd;
}
