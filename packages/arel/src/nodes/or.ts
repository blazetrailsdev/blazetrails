import { Node, NodeVisitor } from "./node.js";

/**
 * OR node — represents a disjunction.
 *
 * Mirrors: Arel::Nodes::Or
 */
export class Or extends Node {
  readonly left: Node;
  readonly right: Node;

  constructor(left: Node, right: Node) {
    super();
    this.left = left;
    this.right = right;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
