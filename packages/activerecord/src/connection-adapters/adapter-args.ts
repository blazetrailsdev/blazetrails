/**
 * Adapter-argument normalization helpers.
 *
 * Extracted from `connection-handling.ts` so `ConnectionPool.newConnection()`
 * can auto-resolve adapters from `dbConfig.adapter` + `dbConfig.configuration`
 * without back-edging through connection-handling.
 *
 * Mirrors Rails' `ActiveRecord::DatabaseConfigurations::HashConfig#connect`,
 * which builds the adapter constructor argument from the resolved
 * configuration hash.
 *
 * @internal
 */

/**
 * Normalize adapter aliases to their canonical name.
 *
 *   postgres / postgresql  → postgresql
 *   mysql / mysql2         → mysql
 *   sqlite / sqlite3       → sqlite
 */
export function normalizeAdapterName(name: string): string {
  switch (name) {
    case "postgresql":
    case "postgres":
      return "postgresql";
    case "mysql":
    case "mysql2":
      return "mysql";
    case "sqlite":
    case "sqlite3":
      return "sqlite";
    default:
      return name;
  }
}

/**
 * Strip the `sqlite[3]://` URL prefix, returning a bare filename
 * (`":memory:"`, path, or empty → `":memory:"`).
 */
export function parseSqliteUrl(url: string): string {
  if (url.startsWith("sqlite3://") || url.startsWith("sqlite://")) {
    const stripped = url.replace(/^sqlite3?:\/\//, "");
    return stripped || ":memory:";
  }
  return url;
}

/**
 * Build the adapter-constructor argument from a configuration hash.
 *
 * SQLite expects the database string directly; PG/MySQL take a config hash
 * (or URL string). Mirrors the inline normalization done by `connectsTo` /
 * `establishWithConfig` and is the resolver used by
 * {@link ConnectionPool#newConnection} when no `adapterFactory` is provided.
 */
export function buildAdapterArg(
  adapterName: string,
  configuration: Record<string, unknown>,
): unknown {
  const normalized = normalizeAdapterName(adapterName);
  const url = configuration.url as string | undefined;
  const database = configuration.database as string | undefined;
  if (normalized === "sqlite") {
    return parseSqliteUrl(url || database || ":memory:");
  }
  if (url && database === undefined) {
    return url;
  }
  const { adapter: _a, url: _u, username, ...rest } = configuration;
  const adapterConfig: Record<string, unknown> = { ...rest };
  if (adapterConfig.user === undefined && username !== undefined) {
    adapterConfig.user = username;
  }
  if (adapterConfig.host === undefined) {
    adapterConfig.host = "localhost";
  }
  return adapterConfig;
}
