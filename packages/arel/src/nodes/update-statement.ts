import { Node, NodeVisitor } from "./node.js";

/**
 * UpdateStatement — UPDATE ... SET ... WHERE ...
 *
 * Mirrors: Arel::Nodes::UpdateStatement
 */
export class UpdateStatement extends Node {
  relation: Node | null;
  values: Node[];
  wheres: Node[];
  orders: Node[];
  limit: Node | null;
  key: Node | null;

  constructor() {
    super();
    this.relation = null;
    this.values = [];
    this.wheres = [];
    this.orders = [];
    this.limit = null;
    this.key = null;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
