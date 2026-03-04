import { Node, NodeVisitor } from "./node.js";
import { As } from "./binary.js";
import { SqlLiteral } from "./sql-literal.js";

/**
 * With — WITH clause for common table expressions.
 *
 * Mirrors: Arel::Nodes::With
 */
export class With extends Node {
  readonly children: Node[];

  constructor(children: Node[]) {
    super();
    this.children = children;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * WithRecursive — WITH RECURSIVE clause.
 */
export class WithRecursive extends With {}

/**
 * TableAlias — allows a subquery or CTE to be given a name.
 */
export class TableAlias extends Node {
  readonly relation: Node;
  readonly name: string;

  constructor(relation: Node, name: string) {
    super();
    this.relation = relation;
    this.name = name;
  }

  get(columnName: string): Node {
    return new SqlLiteral(`"${this.name}"."${columnName}"`);
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
