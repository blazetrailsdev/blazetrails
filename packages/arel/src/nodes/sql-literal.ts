import { Node, NodeVisitor } from "./node.js";

/**
 * SqlLiteral — a raw SQL string passed through unescaped.
 *
 * Mirrors: Arel::Nodes::SqlLiteral
 */
export class SqlLiteral extends Node {
  readonly value: string;
  retryableFlag = false;

  constructor(value: string, options?: { retryable?: boolean }) {
    super();
    this.value = value;
    if (options?.retryable) {
      this.retryableFlag = true;
    }
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
