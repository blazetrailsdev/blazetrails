/**
 * SpawnMethods — methods for creating derivative relations.
 *
 * The actual spawn/merge/except/only implementations live on Relation.
 * This module exists to match the Rails file structure.
 *
 * Mirrors: ActiveRecord::SpawnMethods
 */

/**
 * The SpawnMethods module interface.
 *
 * Mirrors: ActiveRecord::SpawnMethods
 */
export interface SpawnMethods {
  spawn(): unknown;
  merge(other: unknown): unknown;
  except(...skips: string[]): unknown;
  only(...onlies: string[]): unknown;
}
