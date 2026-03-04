import { Node, NodeVisitor } from "./node.js";

/**
 * AND node — represents a conjunction of children.
 *
 * Mirrors: Arel::Nodes::And
 */
export class And extends Node {
  readonly children: Node[];

  constructor(children: Node[]) {
    super();
    this.children = children;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
