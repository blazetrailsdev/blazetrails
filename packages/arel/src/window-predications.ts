import type { Node } from "./nodes/node.js";
import { Over } from "./nodes/over.js";
import { SqlLiteral } from "./nodes/sql-literal.js";

/**
 * WindowPredications — `over` mixin.
 *
 * Mirrors: Arel::WindowPredications (activerecord/lib/arel/window_predications.rb).
 */
export interface WindowPredicationsModule {
  // Rails accepts any expr (`def over(expr = nil)`); allow Node, a
  // trusted raw SQL string fragment, or null. Subclasses (e.g.
  // NamedFunction) widen further to accept Window / NamedWindow. String
  // arguments are passed through via SqlLiteral and emitted verbatim —
  // use NamedWindow for window names you want surfaced as AST nodes
  // (with proper identifier quoting) rather than as trusted SQL.
  over(expr?: Node | string | null): Over;
}

export const WindowPredications: WindowPredicationsModule = {
  over(this: Node, expr: Node | string | null = null): Over {
    // String arguments are wrapped in SqlLiteral and rendered verbatim
    // (raw SQL fragment) in the OVER clause — they are not escaped as
    // identifiers. Without this wrapping the visitor would treat the
    // string as a value and emit `OVER 'w'` instead of `OVER w`. Pass a
    // NamedWindow when you want identifier-quoted output.
    const right = typeof expr === "string" ? new SqlLiteral(expr) : (expr as Node | null);
    return new Over(this, right);
  },
};
