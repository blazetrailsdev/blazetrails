import { Node, NodeVisitor } from "./node.js";
import type { Attribute } from "./attribute.js";

/**
 * Casted — a value bound to a specific attribute for type casting.
 *
 * Mirrors: Arel::Nodes::Casted
 */
export class Casted extends Node {
  readonly value: unknown;
  readonly attribute: Attribute;

  constructor(value: unknown, attribute: Attribute) {
    super();
    this.value = value;
    this.attribute = attribute;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
