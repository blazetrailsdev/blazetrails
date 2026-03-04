import { Node, NodeVisitor } from "./node.js";
import { JoinSource } from "./join-source.js";

/**
 * SelectCore — the core of a SELECT statement (projections, from, where, etc.).
 *
 * Mirrors: Arel::Nodes::SelectCore
 */
export class SelectCore extends Node {
  source: JoinSource;
  projections: Node[];
  wheres: Node[];
  groups: Node[];
  havings: Node[];
  windows: Node[];
  setQuantifier: Node | null;

  constructor() {
    super();
    this.source = new JoinSource(null);
    this.projections = [];
    this.wheres = [];
    this.groups = [];
    this.havings = [];
    this.windows = [];
    this.setQuantifier = null;
  }

  get from(): Node | null {
    return this.source.left;
  }

  set from(value: Node | null) {
    this.source.left = value;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
