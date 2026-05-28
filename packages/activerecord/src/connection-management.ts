import { BodyProxy } from "@blazetrails/rack";
import { QueryCache } from "./query-cache.js";
import { ConnectionPool } from "./connection-adapters/abstract/connection-pool.js";

/**
 * Tracks whether any Executor.wrap is currently running. Mirrors
 * ActiveSupport::ExecutionWrapper's class-level `active?` / `active_key`.
 * When a wrap is already active, nested wraps skip hook execution.
 */
let executorActive = false;

/**
 * Minimal executor: registers hooks and wraps a function, running run/complete
 * around it. Re-entrant: nested wraps skip hooks (mirrors Rails
 * `ActiveSupport::ExecutionWrapper.wrap` returning `yield if active?`).
 *
 * Mirrors: ActiveSupport::Executor
 */
export class Executor {
  private hooks: Array<{ run(): unknown; complete?(...args: unknown[]): void }> = [];

  registerHook(hook: { run(): unknown; complete?(...args: unknown[]): void }): void {
    this.hooks.push(hook);
  }

  wrap<T>(fn: () => T): T {
    if (executorActive) return fn();
    executorActive = true;
    const states = this.hooks.map((h) => h.run());
    try {
      return fn();
    } finally {
      this.hooks.forEach((h, i) => h.complete?.(states[i]));
      executorActive = false;
    }
  }
}

/**
 * Stub tracker — real async query cancellation is not yet supported.
 *
 * Mirrors: ActiveRecord::AsynchronousQueriesTracker
 * @internal
 */
export class AsynchronousQueriesTracker {
  static installExecutorHooks(
    executor: { registerHook(hook: { run(): unknown; complete?(): void }): void } = new Executor(),
  ): void {
    executor.registerHook({
      run() {
        return undefined;
      },
      complete() {},
    });
  }
}

/**
 * Middleware that wraps the request in an executor cycle and returns a
 * BodyProxy so connection clearing happens after the response body is consumed.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::ConnectionManagement
 * (superseded by executor hooks in Rails 5.1+, but the test contract remains)
 */
export function ConnectionManagement(
  app: (env: Record<string, unknown>) => [number, Record<string, unknown>, unknown],
): (env: Record<string, unknown>) => [number, Record<string, unknown>, BodyProxy] {
  const executor = new Executor();
  QueryCache.installExecutorHooks(executor);
  AsynchronousQueriesTracker.installExecutorHooks(executor);
  ConnectionPool.installExecutorHooks(executor);

  return function (env: Record<string, unknown>): [number, Record<string, unknown>, BodyProxy] {
    const [status, headers, body] = executor.wrap(() => app(env));
    return [status, headers, new BodyProxy(body, () => {})];
  };
}
