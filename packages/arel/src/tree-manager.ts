import { Node } from "./nodes/node.js";
import { PlainString } from "./collectors/plain-string.js";
import { Dot } from "./visitors/dot.js";
import { Limit, Offset } from "./nodes/unary.js";
import { buildQuoted } from "./nodes/casted.js";

/**
 * Methods from Arel::TreeManager::StatementMethods — mixed into
 * DeleteManager and UpdateManager in Rails (NOT SelectManager or
 * InsertManager). Apply with `include(Cls, StatementMethods)` from
 * @blazetrails/activesupport.
 */
type StatementMethodsHost = {
  ast: {
    key?: unknown;
    wheres?: Node[];
    orders?: Node[];
    limit?: Node | null;
    offset?: Node | null;
  };
};

export class StatementMethods {
  take(this: StatementMethodsHost, limit: unknown): unknown {
    if (limit != null) this.ast.limit = new Limit(buildQuoted(limit));
    return this;
  }

  offset(this: StatementMethodsHost, offset: unknown): unknown {
    if (offset != null) this.ast.offset = new Offset(buildQuoted(offset));
    return this;
  }

  order(this: StatementMethodsHost, ...expr: Node[]): unknown {
    this.ast.orders = expr;
    return this;
  }

  where(this: StatementMethodsHost, expr: Node): unknown {
    (this.ast.wheres ??= []).push(expr);
    return this;
  }

  set key(key: unknown) {
    (this as unknown as StatementMethodsHost).ast.key = key;
  }

  get key(): unknown {
    return (this as unknown as StatementMethodsHost).ast.key;
  }

  set wheres(exprs: Node[]) {
    (this as unknown as StatementMethodsHost).ast.wheres = exprs;
  }

  get wheres(): Node[] {
    return (this as unknown as StatementMethodsHost).ast.wheres ?? [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export abstract class TreeManager {
  abstract readonly ast: Node;

  toDot(): string {
    const collector = new PlainString();
    const dot = new Dot();
    dot.accept(this.ast, collector);
    return collector.value;
  }

  toSql(): string {
    // Route through the same Node#toSql() the registry powers, so a
    // `setToSqlVisitor()` override (e.g. SQLite for the parity runner)
    // applies to managers as well as raw nodes. Plain `new ToSql()`
    // would always be the generic visitor.
    return this.ast.toSql();
  }
}

// Methods supplied by the FactoryMethods mixin (runtime wiring in ./index.ts).
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TreeManager {
  createTrue(): import("./nodes/true.js").True;
  createFalse(): import("./nodes/false.js").False;
  createTableAlias(relation: Node, name: string): import("./nodes/table-alias.js").TableAlias;
  createJoin(
    to: Node,
    constraint?: Node | null,
    klass?: new (left: Node, right: Node | null) => import("./nodes/binary.js").Join,
  ): import("./nodes/binary.js").Join;
  createStringJoin(to: string | Node): import("./nodes/string-join.js").StringJoin;
  createAnd(clauses: Node[]): import("./nodes/and.js").And;
  createOn(expr: Node): import("./nodes/unary.js").On;
  grouping(expr: Node): import("./nodes/grouping.js").Grouping;
  lower(column: Node): import("./nodes/named-function.js").NamedFunction;
  coalesce(...exprs: Node[]): import("./nodes/named-function.js").NamedFunction;
  cast(expr: Node, type: string): import("./nodes/named-function.js").NamedFunction;
}
