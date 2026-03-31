import { Nodes } from "@blazetrails/arel";
import type { PredicateBuilder } from "../predicate-builder.js";
import { Range } from "../../connection-adapters/postgresql/oid/range.js";

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

    // Build the scalar values predicate, using NullPredicate as identity
    let valuesPredicate: Nodes.Node | typeof NullPredicate;
    if (values.length === 0) {
      valuesPredicate = NullPredicate;
    } else if (values.length === 1) {
      valuesPredicate = this.predicateBuilder.build(attribute, values[0]);
    } else {
      valuesPredicate = attribute.in(values);
    }

    // Fold in NULL with Grouping to preserve precedence
    if (hasNull) {
      valuesPredicate =
        valuesPredicate === NullPredicate
          ? attribute.isNull()
          : groupedOr(valuesPredicate as Nodes.Node, attribute.isNull());
    }

    // Fold in ranges with Grouping to preserve precedence
    if (ranges.length === 0) {
      return valuesPredicate === NullPredicate ? attribute.in([]) : (valuesPredicate as Nodes.Node);
    }

    const rangePreds = ranges.map((r) => this.predicateBuilder.buildRangePredicate(attribute, r));
    let result: Nodes.Node | typeof NullPredicate = valuesPredicate;
    for (const rp of rangePreds) {
      result = result === NullPredicate ? rp : groupedOr(result as Nodes.Node, rp);
    }
    return result as Nodes.Node;
  }
}

function groupedOr(left: Nodes.Node, right: Nodes.Node): Nodes.Grouping {
  return new Nodes.Grouping(new Nodes.Or(left, right));
}
