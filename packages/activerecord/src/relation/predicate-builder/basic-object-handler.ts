/**
 * BasicObjectHandler — handles simple scalar values in WHERE predicates.
 *
 * Converts `where(name: "Alice")` into an equality predicate.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::BasicObjectHandler
 */

export class BasicObjectHandler {
  call(attribute: any, value: unknown): any {
    return attribute.eq(value);
  }
}
