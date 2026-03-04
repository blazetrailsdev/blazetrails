import { Node, NodeVisitor } from "./node.js";

/**
 * JoinSource — wraps the FROM table and an array of join clauses.
 *
 * Mirrors: Arel::Nodes::JoinSource
 */
export class JoinSource extends Node {
  left: Node | null;
  right: Node[];

  constructor(left: Node | null, right: Node[] = []) {
    super();
    this.left = left;
    this.right = right;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
