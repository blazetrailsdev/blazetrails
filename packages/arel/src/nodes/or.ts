import { Node } from "./node.js";
import { Nary } from "./nary.js";

/**
 * OR node — represents a disjunction.
 * In Rails, Or = Class.new(Nary), so it stores children[].
 * Accepts either `new Or([a, b])` (Rails-style) or `new Or(a, b)` for compat.
 *
 * Mirrors: Arel::Nodes::Or
 */
export class Or extends Nary {
  constructor(childrenOrLeft: Node[] | Node, right?: Node) {
    if (Array.isArray(childrenOrLeft)) {
      super(childrenOrLeft);
    } else {
      super([childrenOrLeft, right!]);
    }
  }
}
