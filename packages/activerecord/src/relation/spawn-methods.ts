/**
 * SpawnMethods — methods for creating derivative relations.
 *
 * Mirrors: ActiveRecord::SpawnMethods
 */

import { Merger } from "./merger.js";

interface SpawnRelation<T = unknown> {
  _clone(): T;
}

/**
 * Create a fresh copy of this relation.
 *
 * Mirrors: ActiveRecord::SpawnMethods#spawn
 */
export function performSpawn<T extends SpawnRelation<T>>(this: T): T {
  return this._clone();
}

/**
 * Merge another relation's conditions into this one.
 * The `other` parameter is typed as `any` because Merger reads
 * many Relation internals that aren't part of SpawnRelation.
 *
 * Mirrors: ActiveRecord::SpawnMethods#merge
 */
export function performMerge<T extends SpawnRelation<T>>(this: T, other: any): T {
  return new Merger(this, other).merge() as T;
}

/**
 * In-place merge — mutates this relation directly.
 *
 * Mirrors: ActiveRecord::SpawnMethods#merge!
 */
export function mergeBang<T extends SpawnRelation<T>>(this: T, other: any): T {
  if (typeof other === "object" && other !== null && "_modelClass" in other) {
    return new Merger(this, other).merge() as T;
  }
  return this;
}
