import { Node, NodeVisitor } from "./node.js";

/**
 * DeleteStatement — DELETE FROM ... WHERE ...
 *
 * Mirrors: Arel::Nodes::DeleteStatement
 */
export class DeleteStatement extends Node {
  relation: Node | null;
  wheres: Node[];
  orders: Node[];
  limit: Node | null;

  constructor() {
    super();
    this.relation = null;
    this.wheres = [];
    this.orders = [];
    this.limit = null;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
