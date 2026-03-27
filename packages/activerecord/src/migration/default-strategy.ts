/**
 * Default migration execution strategy.
 *
 * Mirrors: ActiveRecord::Migration::DefaultStrategy
 */

export class DefaultStrategy {
  async exec(method: string, args: unknown[]): Promise<unknown> {
    throw new Error(`DefaultStrategy#exec must be overridden for: ${method}`);
  }
}
