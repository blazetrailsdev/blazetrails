/**
 * Migration execution strategy — controls how migration methods are invoked.
 *
 * Mirrors: ActiveRecord::Migration::ExecutionStrategy
 *
 * Subclasses can wrap execution with advisory locks, logging, or
 * other cross-cutting concerns.
 */

export abstract class ExecutionStrategy {
  abstract exec(
    direction: "up" | "down",
    migration: { up(adapter: unknown): Promise<void>; down(adapter: unknown): Promise<void> },
    adapter: unknown,
  ): Promise<void>;
}
