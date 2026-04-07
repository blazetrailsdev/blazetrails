import { Node } from "./node.js";
import { Unary } from "./unary.js";

/**
 * ValuesList — VALUES (...), (...), ...
 *
 * Mirrors: Arel::Nodes::ValuesList (extends Unary, rows aliases expr)
 */
export class ValuesList extends Unary {
  constructor(rows: Node[][]) {
    super(rows as unknown as Node);
  }

  get rows(): Node[][] {
    return this.expr as unknown as Node[][];
  }
}
