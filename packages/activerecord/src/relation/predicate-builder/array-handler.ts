/**
 * ArrayHandler — handles array values in WHERE predicates.
 *
 * Converts `where(id: [1, 2, 3])` into an IN clause.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::ArrayHandler
 */

export class ArrayHandler {
  call(attribute: any, value: unknown[]): any {
    if (value.length === 0) {
      return attribute.in([]);
    }
    const nonnull = value.filter((v) => v !== null && v !== undefined);
    const hasNull = nonnull.length < value.length;

    let node = attribute.in(nonnull);
    if (hasNull) {
      const eqNull = attribute.eq(null);
      node = (node as any).or(eqNull);
    }
    return node;
  }
}

/**
 * NullHandler — handles the NULL case extracted from arrays.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::ArrayHandler::NullHandler
 */
export class NullHandler {
  call(attribute: any): any {
    return attribute.eq(null);
  }
}
