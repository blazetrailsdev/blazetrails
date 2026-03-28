/**
 * Migration compatibility — versioned migration behavior.
 *
 * Mirrors: ActiveRecord::Migration::Compatibility
 *
 * Each version class preserves the migration behavior from that version.
 * Old migrations continue to work as originally written even as the
 * migration DSL evolves.
 *
 * Usage:
 *   class CreateUsers extends Migration.forVersion(1.0) {
 *     async change() { ... }
 *   }
 *
 * The current version is always available as Migration.Current.
 */

import type { Migration } from "../migration.js";

type MigrationClass = abstract new (...args: any[]) => Migration;

const CURRENT_VERSION = "1.0";

const versionRegistry = new Map<string, MigrationClass>();

/**
 * Register a migration version class.
 */
export function registerVersion(version: string, klass: MigrationClass): void {
  versionRegistry.set(version, klass);
}

/**
 * Look up the migration base class for a given version.
 * Returns the exact version if registered, or the nearest lower version.
 *
 * Mirrors: ActiveRecord::Migration::Compatibility.find(version)
 */
export function findVersion(version: string | number): MigrationClass {
  const key = String(version);
  const exact = versionRegistry.get(key);
  if (exact) return exact;

  // Find nearest lower version
  const numericTarget = parseFloat(key);
  let best: MigrationClass | undefined;
  let bestVersion = -Infinity;

  for (const [v, klass] of versionRegistry) {
    const num = parseFloat(v);
    if (num <= numericTarget && num > bestVersion) {
      bestVersion = num;
      best = klass;
    }
  }

  if (best) return best;
  throw new Error(
    `Unknown migration version: ${version}. ` +
      `Registered versions: ${[...versionRegistry.keys()].sort().join(", ")}`,
  );
}

/**
 * Get the current (latest) migration version string.
 */
export function currentVersion(): string {
  return CURRENT_VERSION;
}

/**
 * Mirrors: ActiveRecord::Migration::Compatibility
 */
export interface Compatibility {
  version: string;
}

export { CURRENT_VERSION };
