/**
 * SpawnMethods — methods for creating derivative relations.
 *
 * Mirrors: ActiveRecord::SpawnMethods
 */

import { Merger } from "./merger.js";

interface SpawnRelation {
  _clone(): SpawnRelation;
}

/**
 * Create a fresh copy of this relation.
 *
 * Mirrors: ActiveRecord::SpawnMethods#spawn
 */
export function performSpawn<T extends SpawnRelation>(this: T): T {
  return this._clone() as T;
}

/**
 * Merge another relation's conditions into this one.
 *
 * Mirrors: ActiveRecord::SpawnMethods#merge
 */
export function performMerge<T extends SpawnRelation>(this: T, other: SpawnRelation): T {
  return new Merger(this, other).merge() as T;
}
