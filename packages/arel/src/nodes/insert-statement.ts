import { Node, NodeVisitor } from "./node.js";

/**
 * InsertStatement — INSERT INTO ... VALUES ...
 *
 * Mirrors: Arel::Nodes::InsertStatement
 */
export class InsertStatement extends Node {
  relation: Node | null;
  columns: Node[];
  values: Node | null;

  constructor() {
    super();
    this.relation = null;
    this.columns = [];
    this.values = null;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
