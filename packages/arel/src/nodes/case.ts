import { Node, NodeVisitor } from "./node.js";
import { NodeExpression } from "./node-expression.js";
import { SqlLiteral } from "./sql-literal.js";
import { buildQuoted } from "./casted.js";
import { As, Binary } from "./binary.js";
import { Unary } from "./unary.js";

/**
 * Represents a CASE WHEN ... THEN ... ELSE ... END expression.
 *
 * Rails mutates in-place and returns self for chaining.
 *
 * Mirrors: Arel::Nodes::Case
 */
export class Case extends NodeExpression {
  readonly case: Node | null;
  readonly conditions: When[];
  default: Else | null;

  constructor(operand?: Node, defaultValue?: Node) {
    super();
    this.case = operand ?? null;
    this.conditions = [];
    this.default = defaultValue ? new Else(defaultValue) : null;
  }

  // Property-form override (vs. `when(...) {}`): Predications.when is
  // mixed into NodeExpression as a property via Included<>, and Case
  // overrides with self-mutating semantics (Rails: builds When clauses
  // on this.conditions, returns self).
  when = (condition: Node | unknown, result?: Node | unknown): this => {
    const whenNode = buildQuoted(condition);
    const thenNode = buildQuoted(result === undefined ? null : result);
    this.conditions.push(new When(whenNode, thenNode));
    return this;
  };

  // Mirrors Arel::Nodes::Case#then — sets the right side of the most
  // recent When clause. Rails: `@conditions.last.right = build_quoted(expression)`.
  // Rails raises NoMethodError on `nil.right=` if no #when has been called;
  // we throw a clearer error for the same condition.
  then(result: Node | unknown): this {
    const last = this.conditions[this.conditions.length - 1];
    if (!last) throw new Error("Case#then called before Case#when");
    (last as { right: Node }).right = buildQuoted(result === undefined ? null : result);
    return this;
  }

  else(result: Node | unknown): this {
    this.default = new Else(buildQuoted(result === undefined ? null : result));
    return this;
  }

  as(aliasName: string): As {
    return new As(this, new SqlLiteral(aliasName, { retryable: true }));
  }

  clone(): Case {
    const c = new Case(this.case ?? undefined);
    c.conditions.push(...this.conditions);
    c.default = this.default;
    return c;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

export class When extends Binary {}
export class Else extends Unary {}
