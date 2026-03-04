import { Node, NodeVisitor } from "./node.js";

/**
 * Grouping node — wraps an expression in parentheses.
 *
 * Mirrors: Arel::Nodes::Grouping
 */
export class Grouping extends Node {
  readonly expr: Node;

  constructor(expr: Node) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
