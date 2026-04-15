import * as path from "node:path";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { DatabaseAdapter } from "@blazetrails/activerecord";

export interface DatabaseConfig {
  adapter?: string;
  database?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  url?: string;
  [key: string]: unknown;
}

/**
 * Resolve the current environment.
 * Checks TRAILS_ENV, then NODE_ENV, defaults to "development".
 */
export function resolveEnv(): string {
  return process.env.TRAILS_ENV || process.env.NODE_ENV || "development";
}

/**
 * Load the database configuration for the given environment.
 * Looks for config/database.ts or src/config/database.ts in the cwd.
 */
export async function loadDatabaseConfig(
  env?: string,
  cwd: string = process.cwd(),
): Promise<DatabaseConfig> {
  const resolvedEnv = env ?? resolveEnv();

  // Prefer .ts (source of truth) over .js (compiled)
  const candidates = [
    path.join(cwd, "config", "database.ts"),
    path.join(cwd, "config", "database.js"),
    path.join(cwd, "src", "config", "database.ts"),
    path.join(cwd, "src", "config", "database.js"),
  ];

  let configPath: string | undefined;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      configPath = candidate;
      break;
    }
  }

  if (!configPath) {
    throw new Error(
      "No database config found. Expected config/database.ts (.js) or src/config/database.ts (.js)",
    );
  }

  let mod: any;
  try {
    mod = await import(pathToFileURL(configPath).href);
  } catch (error: any) {
    const rel = path.relative(cwd, configPath);
    const enhanced = new Error(
      `Failed to load database config from "${rel}": ${error.message}. ` +
        `Run with tsx (e.g., "npx tsx node_modules/.bin/trails").`,
    );
    (enhanced as any).cause = error;
    throw enhanced;
  }
  const configs = mod.default ?? mod;

  const envConfig = configs[resolvedEnv];
  if (!envConfig) {
    throw new Error(
      `No database configuration for environment "${resolvedEnv}". ` +
        `Available: ${Object.keys(configs).join(", ")}`,
    );
  }

  return envConfig as DatabaseConfig;
}

export type SchemaFormat = "ts" | "js" | "sql";

/**
 * Resolve the effective `schemaFormat` for CLI dump/load commands.
 *
 * Precedence (highest wins):
 *   1. Explicit CLI flag (`opts.format`) — Rails' rake task arg equivalent
 *   2. `SCHEMA_FORMAT` env var — matches Rails
 *      `ENV.fetch("SCHEMA_FORMAT", ActiveRecord.schema_format).to_sym`
 *      pattern used throughout `activerecord/lib/active_record/railties/
 *      databases.rake`
 *   3. Top-level `schemaFormat` key in config/database.ts — equivalent
 *      of `ActiveRecord.schema_format` (set via
 *      `config.active_record.schema_format` in Rails' application.rb)
 *   4. Existence inference — pick ts/js/sql based on which schema file
 *      is already present in `db/`. Trails-specific convenience so
 *      deleting the old file + dumping migrates format without touching
 *      config.
 *   5. Default "ts"
 *
 * Returns the resolved format. Callers should assign it to
 * `DatabaseTasks.schemaFormat` before invoking dump/load.
 */
export async function resolveSchemaFormat(
  opts: { format?: string } = {},
  cwd: string = process.cwd(),
): Promise<SchemaFormat> {
  const normalize = (raw: string, source: string): SchemaFormat => {
    const normalized = raw.toLowerCase();
    if (normalized !== "ts" && normalized !== "js" && normalized !== "sql") {
      throw new Error(`Invalid ${source} value "${raw}". Expected one of: ts, js, sql.`);
    }
    return normalized;
  };

  if (opts.format) return normalize(opts.format, "--format");

  const envFormat = process.env.SCHEMA_FORMAT?.trim();
  if (envFormat) return normalize(envFormat, "SCHEMA_FORMAT env var");

  // Inspect the config file for a top-level `schemaFormat` key (sibling
  // of the per-env configs). Rails sets this via
  // `config.active_record.schema_format` in config/application.rb; trails
  // folds it into config/database.ts so the one file holds everything a
  // db command needs to know.
  const candidates = [
    path.join(cwd, "config", "database.ts"),
    path.join(cwd, "config", "database.js"),
    path.join(cwd, "src", "config", "database.ts"),
    path.join(cwd, "src", "config", "database.js"),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const mod = (await import(pathToFileURL(candidate).href)) as {
        default?: { schemaFormat?: string };
        schemaFormat?: string;
      };
      const configs = mod.default ?? mod;
      const fromConfig = (configs as { schemaFormat?: string }).schemaFormat;
      if (fromConfig) {
        const normalized = fromConfig.toLowerCase();
        if (normalized === "ts" || normalized === "js" || normalized === "sql") {
          return normalized;
        }
      }
    } catch {
      // Fall through to inference — broken config files are surfaced by
      // the main loadDatabaseConfig call, not this lookup.
    }
    break;
  }

  const dbDir = path.join(cwd, "db");
  if (fs.existsSync(path.join(dbDir, "structure.sql"))) return "sql";
  if (fs.existsSync(path.join(dbDir, "schema.js"))) return "js";
  if (fs.existsSync(path.join(dbDir, "schema.ts"))) return "ts";
  return "ts";
}

/**
 * Create the appropriate database adapter from a config object.
 */
export async function connectAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
  const adapter = config.adapter ?? "sqlite3";

  switch (adapter) {
    case "sqlite3":
    case "sqlite": {
      const { SQLite3Adapter } =
        await import("@blazetrails/activerecord/connection-adapters/sqlite3-adapter.js");
      return new SQLite3Adapter(config.database ?? ":memory:");
    }
    case "postgresql":
    case "postgres": {
      const { PostgreSQLAdapter } =
        await import("@blazetrails/activerecord/adapters/postgresql-adapter.js");
      if (config.url) {
        return new PostgreSQLAdapter(config.url);
      }
      return new PostgreSQLAdapter({
        host: config.host ?? "localhost",
        port: config.port ?? 5432,
        database: config.database,
        user: config.username,
        password: config.password,
      });
    }
    case "mysql2":
    case "mysql": {
      const { Mysql2Adapter } =
        await import("@blazetrails/activerecord/adapters/mysql2-adapter.js");
      if (config.url) {
        return new Mysql2Adapter(config.url);
      }
      return new Mysql2Adapter({
        host: config.host ?? "localhost",
        port: config.port ?? 3306,
        database: config.database,
        user: config.username,
        password: config.password,
      });
    }
    default:
      throw new Error(`Unknown database adapter: "${adapter}"`);
  }
}
