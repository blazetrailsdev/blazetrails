/**
 * Suppress persistence operations during a block.
 * Records appear to save but nothing hits the database.
 *
 * Mirrors: ActiveRecord::Suppressor
 */

const _suppressedModels = new Set<Function>();

/**
 * Suppress persistence for the given model class during the block.
 *
 * Mirrors: ActiveRecord::Suppressor.suppress
 */
export async function suppress<R>(modelClass: Function, fn: () => R | Promise<R>): Promise<R> {
  _suppressedModels.add(modelClass);
  try {
    return await fn();
  } finally {
    _suppressedModels.delete(modelClass);
  }
}

/**
 * Check if the given model class is currently suppressed.
 *
 * Mirrors: ActiveRecord::Suppressor.registry
 */
export function isSuppressed(modelClass: Function): boolean {
  if (_suppressedModels.has(modelClass)) return true;
  const parent = Object.getPrototypeOf(modelClass);
  if (parent && _suppressedModels.has(parent)) return true;
  return false;
}
