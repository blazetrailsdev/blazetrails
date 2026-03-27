/**
 * Suppress persistence operations during a block.
 * Records appear to save but nothing hits the database.
 *
 * Mirrors: ActiveRecord::Suppressor
 */

const _suppressionDepth = new Map<Function, number>();

/**
 * Suppress persistence for the given model class during the block.
 * Re-entrant safe: nested suppress blocks increment a depth counter.
 *
 * Mirrors: ActiveRecord::Suppressor.suppress
 */
export async function suppress<R>(modelClass: Function, fn: () => R | Promise<R>): Promise<R> {
  const depth = _suppressionDepth.get(modelClass) ?? 0;
  _suppressionDepth.set(modelClass, depth + 1);
  try {
    return await fn();
  } finally {
    const current = _suppressionDepth.get(modelClass) ?? 1;
    if (current <= 1) {
      _suppressionDepth.delete(modelClass);
    } else {
      _suppressionDepth.set(modelClass, current - 1);
    }
  }
}

/**
 * Check if the given model class is currently suppressed.
 *
 * Mirrors: ActiveRecord::Suppressor.registry
 */
export function isSuppressed(modelClass: Function): boolean {
  if ((_suppressionDepth.get(modelClass) ?? 0) > 0) return true;
  const parent = Object.getPrototypeOf(modelClass);
  if (parent && (_suppressionDepth.get(parent) ?? 0) > 0) return true;
  return false;
}
