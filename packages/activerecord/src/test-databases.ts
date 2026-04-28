/**
 * Test databases — utilities for managing test database lifecycle.
 *
 * Mirrors: ActiveRecord::TestDatabases
 */

import type { DatabaseAdapter } from "./adapter.js";
import type { MigrationProxy } from "./migration.js";
import { Migrator } from "./migration.js";
import type { Base } from "./base.js";
import { DatabaseConfigurations } from "./database-configurations.js";
import { DatabaseTasks } from "./tasks/database-tasks.js";

/**
 * Run migrations on each test database adapter.
 *
 * Mirrors: ActiveRecord::TestDatabases.create_and_migrate
 */
export async function createAndMigrate(
  adapters: DatabaseAdapter[],
  migrations: MigrationProxy[],
): Promise<void> {
  for (const adapter of adapters) {
    const migrator = new Migrator(adapter, migrations, { environment: "test" });
    await migrator.up();
  }
}

/**
 * Iterate over test database adapters, calling the callback for each.
 *
 * Mirrors: ActiveRecord::TestDatabases.each_database
 */
export async function eachDatabase(
  adapters: DatabaseAdapter[],
  callback: (adapter: DatabaseAdapter, index: number) => void | Promise<void>,
): Promise<void> {
  for (let i = 0; i < adapters.length; i++) {
    await callback(adapters[i], i);
  }
}

/**
 * Pull the database path out of a URL-shaped config when the explicit
 * `database` field isn't populated. trails' `UrlConfig` doesn't override
 * `database` to parse the URL the way Rails does, so URL-only configs
 * (e.g. `{ adapter: "sqlite3", url: "test/db/primary.sqlite3" }`)
 * present `dbConfig.database === undefined`. Mirrors Rails' fallback
 * behavior of `URI(url).path.delete_prefix("/")`.
 */
function databaseFromUrl(dbConfig: { configuration?: { url?: string } }): string | undefined {
  const url = dbConfig.configuration?.url;
  if (typeof url !== "string" || url === "") return undefined;
  // sqlite3 URLs are typically file paths (e.g. "test/db/foo.sqlite3"
  // or "sqlite3:test/db/foo.sqlite3"). Try URL parsing first, fall
  // through to the raw string if the URL has no scheme.
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "") || parsed.host || undefined;
  } catch {
    return url;
  }
}

/**
 * Create and load test schema(s) for parallelized test execution.
 *
 * For each configuration in the named environment, appends the index to
 * the database name, purges/creates the database, and loads the schema.
 * Finally re-establishes the connection to the original database(s).
 *
 * Called by ActiveSupport::Testing::Parallelization.after_fork_hook in
 * parallelized test workers (process i gets test databases with suffix `-i`).
 *
 * Mirrors: ActiveRecord::TestDatabases.create_and_load_schema
 */
export async function createAndLoadSchema(
  modelClass: typeof Base,
  index: number,
  { envName }: { envName: string } = { envName: "test" },
): Promise<void> {
  // `Base.configurations` is a raw, OrderedOptions-shaped object with
  // `.toH()` (matches `connection-handling.ts:81`'s usage). Normalize via
  // `DatabaseConfigurations.fromEnv` so subsequent `.configsFor` is safe
  // regardless of whether `configurations` is already a registry, a raw
  // hash, or unset.
  const raw = (modelClass as any).configurations;
  const configurations =
    raw instanceof DatabaseConfigurations
      ? raw
      : DatabaseConfigurations.fromEnv(typeof raw?.toH === "function" ? raw.toH() : (raw ?? {}));
  if (!configurations) return;

  const old = process.env.VERBOSE;
  process.env.VERBOSE = "false";

  try {
    const configs = configurations.configsFor({ envName });
    for (const dbConfig of configs) {
      const baseName = dbConfig.database ?? databaseFromUrl(dbConfig);
      if (!baseName) {
        throw new Error(
          `Cannot suffix database name for ${envName}/${dbConfig.name ?? "(unnamed)"}: ` +
            `neither database nor a parseable URL is available`,
        );
      }
      dbConfig._database = `${baseName}-${index}`;
      await DatabaseTasks.reconstructFromSchema(dbConfig, DatabaseTasks.schemaFormat, undefined);
    }
  } finally {
    // Restore VERBOSE environment variable
    if (old !== undefined) {
      process.env.VERBOSE = old;
    } else {
      delete process.env.VERBOSE;
    }
    // Re-establish connection to original database(s)
    const { establishConnection } = await import("./connection-handling.js");
    await establishConnection(modelClass);
  }
}
