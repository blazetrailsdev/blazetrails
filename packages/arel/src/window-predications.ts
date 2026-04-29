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
  // window-name string, or null. Subclasses (e.g. NamedFunction) widen
  // further to accept Window / NamedWindow.
  over(expr?: Node | string | null): Over;
}

export const WindowPredications: WindowPredicationsModule = {
  over(this: Node, expr: Node | string | null = null): Over {
    // Wrap a window-name string in SqlLiteral so the visitor renders it as
    // a bare identifier (`OVER w`) rather than a quoted value (`OVER 'w'`).
    const right = typeof expr === "string" ? new SqlLiteral(expr) : (expr as Node | null);
    return new Over(this, right);
  },
};
