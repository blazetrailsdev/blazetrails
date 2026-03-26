/**
 * Methods for spawning new Relation instances: merge, except, only.
 * Relation delegates merge() to Merger; except/only are spawn methods
 * that create new relations with certain clauses removed/kept.
 *
 * Mirrors: ActiveRecord::SpawnMethods
 */
export class SpawnMethods {
  static merge(relation: any, other: any): any {
    return relation.merge(other);
  }
}
