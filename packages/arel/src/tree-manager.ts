import { Node } from "./nodes/node.js";
import { PlainString } from "./collectors/plain-string.js";
import { Dot } from "./visitors/dot.js";
import { ToSql } from "./visitors/to-sql.js";
import { Limit, Offset } from "./nodes/unary.js";
import { Quoted } from "./nodes/casted.js";

/**
 * Methods from Arel::TreeManager::StatementMethods — mixed into
 * DeleteManager and UpdateManager in Rails (NOT SelectManager or
 * InsertManager). Apply with `applyStatementMethods(Cls)`.
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
    if (limit != null) this.ast.limit = new Limit(new Quoted(limit));
    return this;
  }

  offset(this: StatementMethodsHost, offset: unknown): unknown {
    if (offset != null) this.ast.offset = new Offset(new Quoted(offset));
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

/**
 * Rails mixes StatementMethods into DeleteManager and UpdateManager. TS
 * lacks Ruby's include semantics, so copy missing property descriptors
 * onto the target's prototype — own-class methods keep priority, matching
 * Ruby's ancestor chain (own class > included module).
 */
export function applyStatementMethods(target: new (...args: never[]) => object): void {
  const proto = StatementMethods.prototype;
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === "constructor") continue;
    if (Object.getOwnPropertyDescriptor(target.prototype, name)) continue;
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (desc) Object.defineProperty(target.prototype, name, desc);
  }
}

export abstract class TreeManager {
  abstract readonly ast: Node;

  toDot(): string {
    const collector = new PlainString();
    const dot = new Dot();
    dot.accept(this.ast, collector);
    return collector.value;
  }

  toSql(): string {
    const visitor = new ToSql();
    return visitor.compile(this.ast);
  }
}
