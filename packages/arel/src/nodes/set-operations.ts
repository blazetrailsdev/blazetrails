import { Node, NodeVisitor } from "./node.js";

/**
 * Union — SELECT ... UNION SELECT ...
 *
 * Mirrors: Arel::Nodes::Union
 */
export class Union extends Node {
  readonly left: Node;
  readonly right: Node;

  constructor(left: Node, right: Node) {
    super();
    this.left = left;
    this.right = right;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * UnionAll — SELECT ... UNION ALL SELECT ...
 */
export class UnionAll extends Node {
  readonly left: Node;
  readonly right: Node;

  constructor(left: Node, right: Node) {
    super();
    this.left = left;
    this.right = right;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * Intersect — SELECT ... INTERSECT SELECT ...
 */
export class Intersect extends Node {
  readonly left: Node;
  readonly right: Node;

  constructor(left: Node, right: Node) {
    super();
    this.left = left;
    this.right = right;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * Except — SELECT ... EXCEPT SELECT ...
 */
export class Except extends Node {
  readonly left: Node;
  readonly right: Node;

  constructor(left: Node, right: Node) {
    super();
    this.left = left;
    this.right = right;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
