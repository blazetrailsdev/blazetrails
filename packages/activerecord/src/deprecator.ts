/**
 * Deprecator — handles deprecation warnings for ActiveRecord.
 *
 * Mirrors: ActiveRecord.deprecator (deprecator.rb)
 * Also covers: gem_version.rb, version.rb
 *
 * MigrationProxy (also mapped to deprecator.rb by api:compare) is re-exported
 * from migration/proxy.ts, which is Node-only (uses node:module for synchronous
 * file loading matching Rails' load_migration).
 */
import { Deprecation } from "@blazetrails/activesupport";

export { Deprecation as Deprecator };

// Re-export so api:compare finds MigrationProxy under deprecator.ts (the extractor
// clones re-exported classes under the re-exporting file's path).
// Node-only: migration/proxy.ts imports node:module — do not use in browser bundles.
export { MigrationProxy } from "./migration/proxy.js";

const _deprecator = new Deprecation({ gem: "activerecord" });

export function deprecator(): Deprecation {
  return _deprecator;
}

export function gemVersion(): string {
  return "8.0.2";
}

export function version(): string {
  return gemVersion();
}

/**
 * Mirrors: ActiveRecord (the root module that exposes .deprecator)
 */
export interface ActiveRecord {
  deprecator(): Deprecation;
}
