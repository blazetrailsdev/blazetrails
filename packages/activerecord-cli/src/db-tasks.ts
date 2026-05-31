import { join, resolve } from "path";
import {
  DatabaseTasks,
  DatabaseConfigurations,
  NoDatabaseError,
  DatabaseAlreadyExists,
} from "@blazetrails/activerecord";

/**
 * Load `config/database.ts` from `cwd` and install it into `DatabaseTasks`.
 * Returns the resolved `DatabaseConfigurations` so callers can inspect it.
 */
async function loadDatabaseConfig(cwd: string): Promise<DatabaseConfigurations> {
  const configPath = resolve(join(cwd, "config", "database.ts"));
  const mod = await import(configPath);
  const raw = mod.default ?? mod;
  const configs = DatabaseConfigurations.fromRaw(raw);
  DatabaseTasks.databaseConfiguration = configs;
  return configs;
}

async function runCreate(
  config: import("@blazetrails/activerecord").DatabaseConfig,
): Promise<boolean> {
  const dbName = config.database ?? "(unknown)";
  try {
    await DatabaseTasks.create(config);
    console.log(`Created database '${dbName}'`);
    return true;
  } catch (err) {
    if (err instanceof DatabaseAlreadyExists) {
      console.error(`Database '${dbName}' already exists`);
      return true;
    }
    console.error(`Couldn't create '${dbName}' database. Please check your configuration.`);
    console.error(String(err));
    return false;
  }
}

async function runDrop(
  config: import("@blazetrails/activerecord").DatabaseConfig,
): Promise<boolean> {
  const dbName = config.database ?? "(unknown)";
  try {
    await DatabaseTasks.drop(config);
    console.log(`Dropped database '${dbName}'`);
    return true;
  } catch (err) {
    if (err instanceof NoDatabaseError) {
      console.error(`Database '${dbName}' does not exist`);
      return true;
    }
    console.error(`Couldn't drop database '${dbName}'`);
    console.error(String(err));
    return false;
  }
}

export async function dbCreate(cwd: string, args: string[]): Promise<number> {
  const all = args.includes("--all");
  try {
    await loadDatabaseConfig(cwd);
  } catch (err) {
    console.error(`ar: failed to load config/database.ts — ${String(err)}`);
    return 1;
  }

  const env = all ? undefined : (DatabaseConfigurations.defaultEnv ?? "development");
  let ok = true;

  if (all) {
    const configs = DatabaseTasks.eachLocalConfiguration();
    for (const config of configs) {
      if (!(await runCreate(config))) ok = false;
    }
  } else {
    const configs = DatabaseTasks.configsFor(env!);
    for (const config of configs) {
      if (!(await runCreate(config))) ok = false;
    }
  }

  return ok ? 0 : 1;
}

export async function dbDrop(cwd: string, args: string[]): Promise<number> {
  const all = args.includes("--all");
  try {
    await loadDatabaseConfig(cwd);
  } catch (err) {
    console.error(`ar: failed to load config/database.ts — ${String(err)}`);
    return 1;
  }

  const env = all ? undefined : (DatabaseConfigurations.defaultEnv ?? "development");
  let ok = true;

  if (all) {
    const configs = DatabaseTasks.eachLocalConfiguration();
    for (const config of configs) {
      if (!(await runDrop(config))) ok = false;
    }
  } else {
    const configs = DatabaseTasks.configsFor(env!);
    for (const config of configs) {
      if (!(await runDrop(config))) ok = false;
    }
  }

  return ok ? 0 : 1;
}
