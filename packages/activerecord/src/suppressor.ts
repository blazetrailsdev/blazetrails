/**
 * Suppress persistence operations during a block.
 * Records appear to save but nothing hits the database.
 *
 * Mirrors: ActiveRecord::Suppressor
 */

/**
 * Re-entrant depth counter keyed by the actual class constructor (not name)
 * so dynamically-created classes that share an inferred `.name` don't alias.
 *
 * Rails uses `ActiveSupport::IsolatedExecutionState` for per-fiber isolation;
 * in single-threaded Node a module-scoped WeakMap is the closest equivalent.
 * AsyncLocalStorage isolation is a deliberate follow-up — see
 * https://github.com/blazetrailsdev/trails/pull/942 for context.
 */
const _suppressionDepth = new WeakMap<Function, number>();

/**
 * Order-preserving membership set so `registry()` can rebuild a Rails-shaped
 * view without iterating the WeakMap (WeakMaps aren't enumerable).
 */
const _suppressedClasses = new Set<Function>();

/**
 * Get the suppressor registry. Returns a name-keyed view where every active
 * suppression maps to `true` — matching Rails' `Suppressor.registry[name]`
 * contract (`true`/previous-state per class name). Built fresh per call from
 * the constructor-keyed internal storage to keep `Function`-identity as the
 * source of truth while exposing the Rails-shaped public surface.
 *
 * Mirrors: ActiveRecord::Suppressor.registry
 */
export function registry(): Record<string, true | undefined> {
  const view: Record<string, true | undefined> = Object.create(null);
  for (const klass of _suppressedClasses) {
    if (klass.name) view[klass.name] = true;
  }
  return view;
}

/**
 * Suppress persistence for the given model class during the block.
 * Re-entrant safe: nested suppress blocks increment a depth counter.
 *
 * Mirrors: ActiveRecord::Suppressor.suppress
 */
export async function suppress<R>(modelClass: Function, fn: () => R | Promise<R>): Promise<R> {
  const depth = _suppressionDepth.get(modelClass) ?? 0;
  _suppressionDepth.set(modelClass, depth + 1);
  _suppressedClasses.add(modelClass);
  try {
    return await fn();
  } finally {
    const current = _suppressionDepth.get(modelClass) ?? 1;
    if (current <= 1) {
      _suppressionDepth.delete(modelClass);
      _suppressedClasses.delete(modelClass);
    } else {
      _suppressionDepth.set(modelClass, current - 1);
    }
  }
}

/**
 * Check if the given model class (or any ancestor) is currently suppressed.
 */
export function isSuppressed(modelClass: Function): boolean {
  let current: unknown = modelClass;
  while (current && typeof current === "function") {
    if (_suppressionDepth.has(current as Function)) return true;
    current = Object.getPrototypeOf(current);
  }
  return false;
}
