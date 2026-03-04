import { Node, NodeVisitor } from "./node.js";

/**
 * ValuesList — VALUES (...), (...), ...
 *
 * Mirrors: Arel::Nodes::ValuesList
 */
export class ValuesList extends Node {
  readonly rows: Node[][];

  constructor(rows: Node[][]) {
    super();
    this.rows = rows;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
