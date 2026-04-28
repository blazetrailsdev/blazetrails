/**
 * Suppress persistence operations during a block.
 * Records appear to save but nothing hits the database.
 *
 * Mirrors: ActiveRecord::Suppressor
 */

/**
 * Per-class suppression depth, keyed by model class name.
 *
 * Mirrors Rails' `ActiveSupport::IsolatedExecutionState[:active_record_suppressor_registry]`
 * — Rails stores `true`/previous-state per class name, gated by Ruby's
 * lexical `ensure`. JS lacks per-fiber state and overlapping async
 * `suppress` blocks need re-entrant accounting, so we store a depth
 * count: `registry[name] > 0` ⇔ suppressed. Truthiness matches Rails'
 * `Suppressor.registry[name] ? true : super` check.
 */
const _suppressorRegistry: Record<string, number | undefined> = {};

/**
 * Get the suppressor registry. Truthy values indicate suppressed classes.
 *
 * Mirrors: ActiveRecord::Suppressor.registry
 */
export function registry(): Record<string, number | undefined> {
  return _suppressorRegistry;
}

/**
 * Suppress persistence for the given model class during the block.
 * Re-entrant safe: nested suppress blocks increment the registry depth.
 *
 * Mirrors: ActiveRecord::Suppressor.suppress
 */
export async function suppress<R>(modelClass: Function, fn: () => R | Promise<R>): Promise<R> {
  const name = modelClass.name;
  _suppressorRegistry[name] = (_suppressorRegistry[name] ?? 0) + 1;
  try {
    return await fn();
  } finally {
    const current = _suppressorRegistry[name] ?? 1;
    if (current <= 1) {
      delete _suppressorRegistry[name];
    } else {
      _suppressorRegistry[name] = current - 1;
    }
  }
}

/**
 * Check if the given model class (or any ancestor) is currently suppressed.
 */
export function isSuppressed(modelClass: Function): boolean {
  let current: unknown = modelClass;
  while (current && typeof current === "function") {
    if ((_suppressorRegistry[(current as Function).name] ?? 0) > 0) return true;
    current = Object.getPrototypeOf(current);
  }
  return false;
}
