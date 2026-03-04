import { Node, NodeVisitor } from "./node.js";

/**
 * Distinct — marks a SELECT as DISTINCT.
 *
 * Mirrors: Arel::Nodes::Distinct
 */
export class Distinct extends Node {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
