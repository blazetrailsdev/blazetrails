import { Node, NodeVisitor } from "./node.js";
import { NodeExpression } from "./node-expression.js";

export class Unary extends NodeExpression {
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

export class Not extends Node {
  readonly expr: Node;

  constructor(expr: Node) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

export class Lateral extends Node {
  readonly subquery: Node;

  constructor(subquery: Node) {
    super();
    this.subquery = subquery;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

export class GroupingElement extends Node {
  readonly expressions: Node[];

  constructor(expressions: Node | Node[]) {
    super();
    this.expressions = Array.isArray(expressions) ? expressions : [expressions];
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

export class Cube extends GroupingElement {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

export class Rollup extends GroupingElement {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

export class GroupingSet extends GroupingElement {
  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

export class Group extends Unary {}
/**
 * `OptimizerHints#expr` is a list of hint strings (or SqlLiteral) — Rails'
 * Arel::Nodes::OptimizerHints stores `[hint1, hint2, ...]`. The Unary base
 * types `expr` as `Node | string | number | null` and TS won't let us
 * widen to an array via `declare`, so the constructor accepts the array
 * and we expose it via a typed `hints` getter. The visitor uses `hints`.
 */
export class OptimizerHints extends Unary {
  constructor(hints: ReadonlyArray<string | import("./sql-literal.js").SqlLiteral>) {
    super(hints as unknown as null);
  }

  get hints(): ReadonlyArray<string | import("./sql-literal.js").SqlLiteral> {
    return this.expr as unknown as ReadonlyArray<string | import("./sql-literal.js").SqlLiteral>;
  }
}
export class RollUp extends Rollup {}
