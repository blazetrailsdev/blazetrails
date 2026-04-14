/**
 * Mirrors: ActiveRecord::DatabaseConfigurations::UrlConfig
 *
 * A configuration built from a connection URL. Parses the URL into a
 * config hash and merges with any provided configuration overrides.
 */
import { HashConfig } from "./hash-config.js";
import type { DatabaseConfigOptions } from "./database-config.js";
import { ConnectionUrlResolver } from "./connection-url-resolver.js";

export class UrlConfig extends HashConfig {
  readonly url: string;

  constructor(
    envName: string,
    name: string,
    url: string,
    configuration: DatabaseConfigOptions = {},
  ) {
    let urlHash: DatabaseConfigOptions = {};
    try {
      urlHash = new ConnectionUrlResolver(url).toHash();
    } catch {
      // Non-standard URLs (e.g. SQLite ':memory:') are passed through to the
      // adapter as-is. Rails raises here; we tolerate for backward-compat.
    }
    // Merge: URL-derived values + explicit overrides + url itself
    super(envName, name, { ...urlHash, ...configuration, url });
    this.url = url;
  }
}
