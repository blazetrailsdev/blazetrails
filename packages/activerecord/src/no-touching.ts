/**
 * Suppresses touch callbacks during a block.
 *
 * Mirrors: ActiveRecord::NoTouching
 */

let _noTouching = false;

/**
 * Execute a block with touch callbacks suppressed.
 *
 * Mirrors: ActiveRecord::NoTouching.no_touching
 */
export async function noTouching<R>(fn: () => R | Promise<R>): Promise<R> {
  _noTouching = true;
  try {
    return await fn();
  } finally {
    _noTouching = false;
  }
}

/**
 * Check if touching is currently suppressed.
 *
 * Mirrors: ActiveRecord::NoTouching.applied_to?
 */
export function isAppliedTo(): boolean {
  return _noTouching;
}

/**
 * Check if touching is currently suppressed on the given record.
 *
 * Mirrors: ActiveRecord::NoTouching#no_touching?
 */
export function isNoTouching(): boolean {
  return _noTouching;
}
