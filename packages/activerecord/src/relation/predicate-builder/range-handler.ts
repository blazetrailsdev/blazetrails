/**
 * Handles range values in where conditions: where({ age: [18, 65] })
 * with range semantics becomes `age BETWEEN 18 AND 65`.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::RangeHandler
 */
export class RangeHandler {
  call(attribute: any, range: { begin: unknown; end: unknown }): any {
    return attribute.between(range.begin, range.end);
  }
}
