/**
 * Handles subquery values in where conditions: where({ id: OtherModel.select(:id) })
 * becomes `id IN (SELECT id FROM other_models)`.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::RelationHandler
 */
export class RelationHandler {
  call(attribute: any, relation: any): any {
    return attribute.in(relation);
  }
}
