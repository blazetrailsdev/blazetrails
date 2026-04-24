import { Node } from "./node.js";
import type { Included } from "@blazetrails/activesupport";
import type { Predications } from "../predications.js";
import type { Math as MathMixin } from "../math.js";

/**
 * NodeExpression — common base for Arel nodes that behave as expressions
 * (attributes, functions, unary ops, etc.). Runtime wiring of the
 * Predications + Math mixins lives in ../index.ts to avoid a module-load
 * cycle between this file and the mixin modules (which reference the
 * concrete node classes that extend NodeExpression).
 *
 * Mirrors: Arel::Nodes::NodeExpression — which `include`s Arel::Expressions,
 *   Arel::Predications, Arel::AliasPredication, Arel::OrderPredications,
 *   and Arel::Math.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export abstract class NodeExpression extends Node {
  /**
   * Wrap a raw value into a Node for use inside predicates. No
   * type-casting here — Attribute overrides this to route through
   * `buildCasted` so the attribute's SQL type drives value coercion.
   *
   * Mirrors: Arel::Predications#quoted_node (private), which calls
   * Nodes.build_quoted(other, self).
   */
  quotedNode(other: unknown): Node {
    if (other instanceof Node) return other;
    if (_buildQuoted) return _buildQuoted(other, this);
    throw new Error("NodeExpression.quotedNode called before buildQuoted was registered");
  }
}

// `buildQuoted` lives in casted.ts, which imports NodeExpression (Casted
// extends it). A direct import would deadlock the class-extends
// expression at module-load time; instead casted.ts registers itself here
// at its own module-init.
let _buildQuoted: ((other: unknown, ctx: unknown) => Node) | undefined;
export function registerBuildQuoted(fn: (other: unknown, ctx: unknown) => Node): void {
  _buildQuoted = fn;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface NodeExpression extends Included<typeof Predications>, Included<typeof MathMixin> {}
