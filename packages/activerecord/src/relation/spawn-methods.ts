/**
 * SpawnMethods — methods for creating derivative relations.
 *
 * Mirrors: ActiveRecord::SpawnMethods
 */

import { Merger } from "./merger.js";

interface SpawnRelation {
  _clone(): any;
}

/**
 * Create a fresh copy of this relation.
 *
 * Mirrors: ActiveRecord::SpawnMethods#spawn
 */
export function performSpawn(this: SpawnRelation): any {
  return this._clone();
}

/**
 * Merge another relation's conditions into this one.
 *
 * Mirrors: ActiveRecord::SpawnMethods#merge
 */
export function performMerge(this: SpawnRelation, other: any): any {
  return new Merger(this, other).merge();
}
