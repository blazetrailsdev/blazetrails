import { Node, NodeVisitor } from "./node.js";
import { SelectCore } from "./select-core.js";

/**
 * SelectStatement — the full SELECT with cores, order, limit, offset, lock.
 *
 * Mirrors: Arel::Nodes::SelectStatement
 */
export class SelectStatement extends Node {
  cores: SelectCore[];
  orders: Node[];
  limit: Node | null;
  offset: Node | null;
  lock: Node | null;
  with: Node | null;

  constructor() {
    super();
    this.cores = [new SelectCore()];
    this.orders = [];
    this.limit = null;
    this.offset = null;
    this.lock = null;
    this.with = null;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
