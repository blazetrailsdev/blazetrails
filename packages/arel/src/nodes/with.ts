import { Node } from "./node.js";
import { Unary } from "./unary.js";

/**
 * With — WITH clause for common table expressions.
 *
 * Mirrors: Arel::Nodes::With (extends Unary, children aliases expr)
 */
export class With extends Unary {
  constructor(children: Node[]) {
    super(children as unknown as Node);
  }

  get children(): Node[] {
    return this.expr as unknown as Node[];
  }
}

/**
 * WithRecursive — WITH RECURSIVE clause.
 */
export class WithRecursive extends With {}
