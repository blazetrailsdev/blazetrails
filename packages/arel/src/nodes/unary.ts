import { Node, NodeVisitor } from "./node.js";

/**
 * Unary — base class for nodes with a single expression.
 *
 * Mirrors: Arel::Nodes::Unary
 */
export class Unary extends Node {
  readonly expr: Node | string | number | null;

  constructor(expr: Node | string | number | null) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

export class Offset extends Unary {}
export class Limit extends Unary {}
export class Top extends Unary {}
export class Lock extends Unary {}
export class DistinctOn extends Unary {}
export class Bin extends Unary {}
export class On extends Unary {}

/**
 * Ascending — ORDER BY ... ASC
 *
 * Mirrors: Arel::Nodes::Ascending
 */
export class Ascending extends Unary {
  get direction(): "asc" {
    return "asc";
  }

  isAscending(): boolean {
    return true;
  }

  isDescending(): boolean {
    return false;
  }

  reverse(): Descending {
    return new Descending(this.expr);
  }
}

/**
 * Descending — ORDER BY ... DESC
 *
 * Mirrors: Arel::Nodes::Descending
 */
export class Descending extends Unary {
  get direction(): "desc" {
    return "desc";
  }

  isAscending(): boolean {
    return false;
  }

  isDescending(): boolean {
    return true;
  }

  reverse(): Ascending {
    return new Ascending(this.expr);
  }
}
