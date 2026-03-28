/**
 * Default migration execution strategy — runs migrations directly.
 *
 * Mirrors: ActiveRecord::Migration::DefaultStrategy
 *
 * Simply calls the migration's up/down method. A custom strategy could
 * wrap this with advisory locks to prevent concurrent migrations.
 */

import { ExecutionStrategy } from "./execution-strategy.js";

export class DefaultStrategy extends ExecutionStrategy {
  async exec(
    direction: "up" | "down",
    migration: { up(adapter: unknown): Promise<void>; down(adapter: unknown): Promise<void> },
    adapter: unknown,
  ): Promise<void> {
    if (direction === "up") {
      await migration.up(adapter);
    } else {
      await migration.down(adapter);
    }
  }
}
