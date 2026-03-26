/**
 * Finder methods mixed into Relation: find, findBy, first, last,
 * take, exists?, sole, findSole.
 *
 * Mirrors: ActiveRecord::FinderMethods
 */
export class FinderMethods {
  static readonly ONE_AS_ONE = "1 AS one" as const;
}
