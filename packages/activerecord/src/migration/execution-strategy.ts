/**
 * Migration execution strategy interface.
 *
 * Mirrors: ActiveRecord::Migration::ExecutionStrategy
 */

export class ExecutionStrategy {
  async exec(method: string, args: unknown[]): Promise<unknown> {
    throw new Error(`ExecutionStrategy#exec must be overridden for: ${method}`);
  }
}
