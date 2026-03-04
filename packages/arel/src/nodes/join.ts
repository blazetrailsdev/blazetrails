import { Node, NodeVisitor } from "./node.js";

/**
 * Base join node.
 *
 * Mirrors: Arel::Nodes::Join
 */
export abstract class Join extends Node {
  readonly left: Node;
  readonly right: Node | null;

  constructor(left: Node, right: Node | null = null) {
    super();
    this.left = left;
    this.right = right;
  }
}

/**
 * INNER JOIN
 *
 * Mirrors: Arel::Nodes::InnerJoin
 */
export class InnerJoin extends Join {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * LEFT OUTER JOIN
 *
 * Mirrors: Arel::Nodes::OuterJoin
 */
export class OuterJoin extends Join {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * RIGHT OUTER JOIN
 */
export class RightOuterJoin extends Join {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * FULL OUTER JOIN
 */
export class FullOuterJoin extends Join {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * CROSS JOIN
 */
export class CrossJoin extends Join {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * A string join (raw SQL join clause).
 *
 * Mirrors: Arel::Nodes::StringJoin
 */
export class StringJoin extends Join {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
