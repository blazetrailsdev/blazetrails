/**
 * Base class for all AST nodes in Arel.
 *
 * Mirrors: Arel::Nodes::Node
 */
export abstract class Node {
  abstract accept<T>(visitor: NodeVisitor<T>): T;
}

/**
 * Visitor interface for the Node hierarchy.
 */
export interface NodeVisitor<T> {
  visit(node: Node): T;
}
