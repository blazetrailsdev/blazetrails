/**
 * `AbstractController::Logger` — config slot for a per-controller
 * logger. Rails additionally mixes in `ActiveSupport::Benchmarkable`
 * (`benchmark(message, &block)`); we expose a small standalone
 * `benchmark` helper that the same callers can reuse.
 *
 * @internal
 */

export interface LoggerLike {
  info?(message: string): void;
  debug?(message: string): void;
  warn?(message: string): void;
}

export interface LoggerHost {
  logger?: LoggerLike;
}

/**
 * Marks a host class as conforming to the `LoggerHost` slot contract.
 * No-op at runtime — see `applyAssetPaths` for the rationale. JS static
 * inheritance gives Rails-style propagation of `logger` for free.
 */
export function applyLogger<T extends new (...args: never[]) => unknown>(
  _cls: T & Partial<LoggerHost>,
): void {
  // Intentionally empty — see asset-paths.ts docstring. The
  // `Partial<LoggerHost>` bound surfaces the slot contract at call
  // sites without requiring the host to pre-declare the slot.
}

/**
 * Mirrors `ActiveSupport::Benchmarkable#benchmark`. Logs the elapsed
 * milliseconds for `block` to `logger.info`, returning whatever the
 * block returns. If no logger is attached the block still runs.
 */
export function benchmark<T>(logger: LoggerLike | undefined, message: string, block: () => T): T {
  if (!logger?.info) return block();
  // Monotonic timing where available — `Date.now()` is wall-clock and
  // can jump under NTP adjustments. The fallback matches the pattern
  // used by `ActiveRecord::Base.benchmark`.
  const now = () => globalThis.performance?.now() ?? Date.now();
  const start = now();
  const result = block();
  const ms = (now() - start).toFixed(1);
  logger.info(`${message} (${ms}ms)`);
  return result;
}
