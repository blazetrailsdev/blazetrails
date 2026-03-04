import { Node, NodeVisitor } from "./node.js";

/**
 * NOT node — negates its expression.
 *
 * Mirrors: Arel::Nodes::Not
 */
export class Not extends Node {
  readonly expr: Node;

  constructor(expr: Node) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
