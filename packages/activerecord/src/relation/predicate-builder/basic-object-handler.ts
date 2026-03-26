/**
 * Default handler for scalar values in where conditions.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::BasicObjectHandler
 */
export class BasicObjectHandler {
  call(attribute: any, value: unknown): any {
    return attribute.eq(value);
  }
}
