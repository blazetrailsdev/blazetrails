import { Node, NodeVisitor } from "./node.js";

/**
 * SqlLiteral — a raw SQL string passed through unescaped.
 *
 * Mirrors: Arel::Nodes::SqlLiteral
 */
export class SqlLiteral extends Node {
  readonly value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
