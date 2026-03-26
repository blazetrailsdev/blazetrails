/**
 * Handles array values in where conditions: where({ id: [1, 2, 3] })
 * becomes `id IN (1, 2, 3)`.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::ArrayHandler
 */
export class ArrayHandler {
  readonly predicate_builder: any;

  constructor(predicateBuilder: any) {
    this.predicate_builder = predicateBuilder;
  }

  call(attribute: any, value: unknown[]): any {
    return attribute.in(value);
  }
}

/**
 * Wraps a null predicate alongside an IN for arrays containing null.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::ArrayHandler::NullPredicate
 */
export class NullPredicate {
  call(attribute: any): any {
    return attribute.eq(null);
  }
}
