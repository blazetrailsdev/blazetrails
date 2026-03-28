/**
 * RangeHandler — handles range values in WHERE predicates.
 *
 * Converts `where(age: { gte: 18, lt: 65 })` style range conditions.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::RangeHandler
 */

export class RangeHandler {
  call(attribute: any, value: { begin?: unknown; end?: unknown }): any {
    if (value.begin != null && value.end != null) {
      return attribute.between(value.begin, value.end);
    }
    if (value.begin != null) {
      return attribute.gteq(value.begin);
    }
    if (value.end != null) {
      return attribute.lteq(value.end);
    }
    return attribute.notEq(null);
  }
}
