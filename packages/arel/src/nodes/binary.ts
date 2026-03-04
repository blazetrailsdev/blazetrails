import { Node, NodeVisitor } from "./node.js";
import { SqlLiteral } from "./sql-literal.js";
import { And } from "./and.js";
import { Or } from "./or.js";
import { Not } from "./not.js";
import { Grouping } from "./grouping.js";

export type NodeOrValue = Node | string | number | boolean | null | undefined;

/**
 * Binary — base class for nodes with left and right operands.
 *
 * Mirrors: Arel::Nodes::Binary
 */
export class Binary extends Node {
  left: NodeOrValue;
  right: NodeOrValue;

  constructor(left: NodeOrValue, right: NodeOrValue) {
    super();
    this.left = left;
    this.right = right;
  }

  as(aliasName: string): As {
    return new As(this, new SqlLiteral(aliasName));
  }

  and(other: Node): And {
    return new And([this, other]);
  }

  or(other: Node): Grouping {
    return new Grouping(new Or(this, other));
  }

  not(): Not {
    return new Not(this);
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/** Assignment: column = value */
export class Assignment extends Binary {}

/** As: expr AS alias */
export class As extends Binary {}

/** Between: expr BETWEEN left AND right */
export class Between extends Binary {}

/** Comparison predicates */
export class Equality extends Binary {}
export class NotEqual extends Binary {}
export class GreaterThan extends Binary {}
export class GreaterThanOrEqual extends Binary {}
export class LessThan extends Binary {}
export class LessThanOrEqual extends Binary {}

/** Pattern predicates */
export class Matches extends Binary {}
export class DoesNotMatch extends Binary {}

/** Set membership */
export class In extends Binary {}
export class NotIn extends Binary {}

/** Math */
export class Addition extends Binary {}
export class Subtraction extends Binary {}
export class Multiplication extends Binary {}
export class Division extends Binary {}
