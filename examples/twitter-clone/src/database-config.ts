import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reads `config/database.json` — the single source of connection config
 * (the analog of Rails' `config/database.yml`). Keyed by environment;
 * `NODE_ENV` selects the entry (default "development"). Nothing else in the
 * app hardcodes connection details — `Base.establishConnection()` reads this
 * same file with no arguments.
 */
const ENV = process.env.NODE_ENV ?? "development";
const CONFIG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "config",
  "database.json",
);

interface EnvConfig {
  adapter?: string;
  database?: string;
  [k: string]: unknown;
}

/** The config hash for the current environment. */
export function currentConfig(): EnvConfig {
  const all = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Record<string, EnvConfig>;
  const cfg = all[ENV];
  if (!cfg || typeof cfg !== "object") {
    throw new Error(`No "${ENV}" entry in config/database.json`);
  }
  return cfg;
}

/** Absolute path of the SQLite file for the current env, or null (e.g. :memory:). */
export function sqliteDatabasePath(): string | null {
  const cfg = currentConfig();
  if (cfg.adapter?.startsWith("sqlite") && cfg.database && cfg.database !== ":memory:") {
    return resolve(cfg.database);
  }
  return null;
}
