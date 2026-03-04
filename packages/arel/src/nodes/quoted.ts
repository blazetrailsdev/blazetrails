import { Node, NodeVisitor } from "./node.js";

/**
 * Quoted — a value that will be quoted/escaped in the output SQL.
 *
 * Mirrors: Arel::Nodes::Quoted
 */
export class Quoted extends Node {
  readonly value: unknown;

  constructor(value: unknown) {
    super();
    this.value = value;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
