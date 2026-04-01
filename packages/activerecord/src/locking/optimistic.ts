import type { Base } from "../base.js";

/**
 * Optimistic locking support for ActiveRecord models.
 * When a model has a lock_version column, updates include a version
 * check to detect concurrent modifications.
 *
 * Mirrors: ActiveRecord::Locking::Optimistic
 */

/**
 * Return the column name used for optimistic locking.
 *
 * Mirrors: ActiveRecord::Locking::Optimistic::ClassMethods#locking_column
 */
export function lockingColumn(modelClass: typeof Base): string {
  return (modelClass as any)._lockingColumn ?? "lock_version";
}

/**
 * Set the column name used for optimistic locking.
 */
export function setLockingColumn(modelClass: typeof Base, column: string): void {
  (modelClass as any)._lockingColumn = column;
}

/**
 * Whether a model class uses optimistic locking (has a lock_version column).
 *
 * Mirrors: ActiveRecord::Locking::Optimistic::ClassMethods#locking_enabled?
 */
export function lockingEnabled(modelClass: typeof Base): boolean {
  return modelClass._attributeDefinitions.has(lockingColumn(modelClass));
}
