/**
 * RelationHandler — handles Relation values in WHERE predicates.
 *
 * Converts `where(id: User.where(active: true))` into a subquery.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::RelationHandler
 */

export class RelationHandler {
  call(attribute: any, value: { toArel(): { ast: unknown } }): any {
    return attribute.in(value.toArel());
  }
}
