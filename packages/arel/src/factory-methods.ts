import type { Node } from "./nodes/node.js";
import { And } from "./nodes/and.js";
import type { Join } from "./nodes/binary.js";
import { False } from "./nodes/false.js";
import { Grouping } from "./nodes/grouping.js";
import { InnerJoin } from "./nodes/inner-join.js";
import { NamedFunction } from "./nodes/named-function.js";
import { SqlLiteral } from "./nodes/sql-literal.js";
import { StringJoin } from "./nodes/string-join.js";
import { TableAlias } from "./nodes/table-alias.js";
import { True } from "./nodes/true.js";
import { On } from "./nodes/unary.js";

/**
 * Mirrors: Arel::FactoryMethods (Ruby module mixed into Node and TreeManager).
 *
 * Apply with `include(Klass, FactoryMethods)` from @blazetrails/activesupport
 * and augment the class type with `Included<typeof FactoryMethods>`.
 */
export const FactoryMethods = {
  createTrue(): True {
    return new True();
  },

  createFalse(): False {
    return new False();
  },

  createTableAlias(relation: Node, name: string): TableAlias {
    return new TableAlias(relation, name);
  },

  createJoin(
    to: Node,
    constraint?: Node | null,
    klass?: new (left: Node, right: Node | null) => Join,
  ): Join {
    const JoinKlass = klass ?? InnerJoin;
    return new JoinKlass(to, constraint ?? null);
  },

  createStringJoin(to: string | Node): StringJoin {
    const node = typeof to === "string" ? new SqlLiteral(to) : to;
    return new StringJoin(node, null);
  },

  createAnd(clauses: Node[]): And {
    return new And(clauses);
  },

  createOn(expr: Node): On {
    return new On(expr);
  },

  grouping(expr: Node): Grouping {
    return new Grouping(expr);
  },

  lower(column: Node): NamedFunction {
    return new NamedFunction("LOWER", [column]);
  },

  coalesce(...exprs: Node[]): NamedFunction {
    return new NamedFunction("COALESCE", exprs);
  },

  cast(expr: Node, type: string): NamedFunction {
    return new NamedFunction("CAST", [new SqlLiteral(`${expr} AS ${type}`)]);
  },
};
