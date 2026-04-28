/**
 * Suppress persistence operations during a block.
 * Records appear to save but nothing hits the database.
 *
 * Mirrors: ActiveRecord::Suppressor
 */

/**
 * The shared, mutable suppression registry — single module-level object
 * returned by `registry()`. Mirrors Rails'
 * `ActiveSupport::IsolatedExecutionState[:active_record_suppressor_registry]`:
 * a Rails-side `Suppressor.registry[Klass.name] = true` is what `suppress`
 * does, and `save`/`save!` check `Suppressor.registry[self.class.name]`.
 *
 * Stored as numeric depth (`registry[name] > 0` ⇔ suppressed) so re-entrant
 * `suppress` calls compose correctly in async JS. Truthy values still
 * satisfy Rails' `registry[name] ? true : super` check at every call site.
 *
 * `Object.create(null)` avoids surprises from prototype keys
 * (`__proto__`/`constructor`).
 */
const _suppressorRegistry: Record<string, number | undefined> = Object.create(null);

/**
 * Get the suppressor registry. Returns the same mutable object on every
 * call — callers can hold a reference and observe mutations (Rails parity).
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
  if (!name) {
    // Anonymous classes can't participate in the name-keyed registry
    // (Rails has the same constraint); just run the block.
    return await fn();
  }
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
 * Walks the prototype chain so subclass instances honor a parent-class
 * suppression.
 */
export function isSuppressed(modelClass: Function): boolean {
  let current: unknown = modelClass;
  while (current && typeof current === "function") {
    const name = (current as Function).name;
    if (name && (_suppressorRegistry[name] ?? 0) > 0) return true;
    current = Object.getPrototypeOf(current);
  }
  return false;
}
