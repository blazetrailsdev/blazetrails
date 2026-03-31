import { Nodes } from "@blazetrails/arel";
import type { PredicateBuilder } from "../predicate-builder.js";
import { Range } from "../../connection-adapters/postgresql/oid/range.js";

/**
 * Handles array values in where conditions by splitting them into
 * scalar values, nils, and ranges, then combining with OR predicates.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::ArrayHandler
 *
 * Examples:
 *   where({ id: [1, 2, 3] })          → id IN (1, 2, 3)
 *   where({ id: [1, null, 3] })       → id IN (1, 3) OR id IS NULL
 *   where({ age: [18, new Range(25, 30)] }) → age IN (18) OR age BETWEEN 25 AND 30
 */
/**
 * Null-object used when no scalar values exist in an array condition.
 * Its `or()` returns the other operand, acting as an identity for OR chains.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::ArrayHandler::NullPredicate
 */
export class NullPredicate {
  static or(other: Nodes.Node): Nodes.Node {
    return other;
  }
}

export class ArrayHandler {
  private predicateBuilder: PredicateBuilder;

  constructor(predicateBuilder: PredicateBuilder) {
    this.predicateBuilder = predicateBuilder;
  }

  call(attribute: Nodes.Attribute, value: unknown[]): Nodes.Node {
    if (value.length === 0) {
      return attribute.in([]);
    }

    const values: unknown[] = [];
    let hasNull = false;
    const ranges: Range[] = [];

    for (const item of value) {
      if (item === null || item === undefined) {
        hasNull = true;
      } else if (item instanceof Range) {
        ranges.push(item);
      } else if (typeof item === "object" && item !== null && "id" in item) {
        values.push((item as any).id);
      } else {
        values.push(item);
      }
    }

    let predicate: Nodes.Node | null = null;

    if (values.length === 1) {
      predicate = attribute.eq(values[0]);
    } else if (values.length > 1) {
      predicate = attribute.in(values);
    }

    if (hasNull) {
      const nullPred = attribute.isNull();
      predicate = predicate ? new Nodes.Or(predicate, nullPred) : nullPred;
    }

    for (const range of ranges) {
      const rangePred = this.predicateBuilder.buildRangePredicate(attribute, range);
      predicate = predicate ? new Nodes.Or(predicate, rangePred) : rangePred;
    }

    return predicate ?? attribute.in([]);
  }
}
