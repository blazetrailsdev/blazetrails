/**
 * WhereClause — manages WHERE predicates on a Relation.
 *
 * Stores a single array of Arel nodes, matching Rails' WhereClause which
 * holds a flat `predicates` array. All condition types (hash, raw SQL,
 * NOT, Arel nodes) are converted to nodes at insertion time.
 *
 * Mirrors: ActiveRecord::Relation::WhereClause
 */

import { Visitors, Nodes } from "@blazetrails/arel";

export class WhereClause {
  predicates: Nodes.Node[];

  constructor(predicates: Nodes.Node[] = []) {
    this.predicates = predicates;
  }

  static empty(): WhereClause {
    return new WhereClause();
  }

  isEmpty(): boolean {
    return this.predicates.length === 0;
  }

  merge(other: WhereClause): WhereClause {
    return new WhereClause([...this.predicates, ...other.predicates]);
  }

  invert(): WhereClause {
    if (this.predicates.length === 0) return this.clone();
    if (this.predicates.length === 1) {
      return new WhereClause([invertPredicate(this.predicates[0])]);
    }
    return new WhereClause([new Nodes.Not(this.ast)]);
  }

  except(...columns: string[]): WhereClause {
    const colSet = new Set(columns);
    const kept = this.predicates.filter((node) => {
      const attr = fetchAttribute(node);
      return attr === null || !colSet.has(attr);
    });
    return new WhereClause(kept);
  }

  clear(): void {
    this.predicates.length = 0;
  }

  clone(): WhereClause {
    return new WhereClause([...this.predicates]);
  }

  or(other: WhereClause): WhereClause {
    if (this.isEmpty()) return other.clone();
    if (other.isEmpty()) return this.clone();

    const selfPreds = this.predicates;
    const otherPreds = other.predicates;

    const leftOnly = subtractNodes(selfPreds, otherPreds);
    const common = subtractNodes(selfPreds, leftOnly);
    const rightOnly = subtractNodes(otherPreds, common);

    if (leftOnly.length === 0 || rightOnly.length === 0) {
      return new WhereClause([...common]);
    }

    let leftAst: Nodes.Node = leftOnly.length === 1 ? leftOnly[0] : new Nodes.And(leftOnly);
    if (leftAst instanceof Nodes.Grouping) leftAst = leftAst.expr;

    let rightAst: Nodes.Node = rightOnly.length === 1 ? rightOnly[0] : new Nodes.And(rightOnly);
    if (rightAst instanceof Nodes.Grouping) rightAst = rightAst.expr;

    const orNode =
      leftAst instanceof Nodes.Or
        ? new Nodes.Or([...leftAst.children, rightAst])
        : new Nodes.Or([leftAst, rightAst]);

    return new WhereClause([...common, new Nodes.Grouping(orNode)]);
  }

  get ast(): Nodes.Node {
    if (this.predicates.length === 1) return this.predicates[0];
    return new Nodes.And(this.predicates);
  }

  toSql(): string {
    if (this.predicates.length === 0) return "";
    return visitor.compile(this.ast);
  }

  isContradiction(): boolean {
    for (const node of this.predicates) {
      if (node instanceof Nodes.In) {
        const right = (node as any).right;
        if (Array.isArray(right) && right.length === 0) return true;
      }
      if (node instanceof Nodes.Equality) {
        const right = (node as any).right;
        if (right && typeof right === "object" && "unboundable" in right && right.unboundable)
          return true;
      }
    }
    return false;
  }

  extractAttributes(): string[] {
    const attrs: string[] = [];
    for (const node of this.predicates) {
      const attr = fetchAttribute(node);
      if (attr !== null) attrs.push(attr);
    }
    return attrs;
  }

  toH(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const node of this.predicates) {
      if (node instanceof Nodes.Equality) {
        const attr = fetchAttribute(node);
        if (attr !== null) {
          result[attr] = extractNodeValue((node as any).right);
        }
      }
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function invertPredicate(node: Nodes.Node): Nodes.Node {
  if (typeof node === "string") {
    return new Nodes.Not(new Nodes.SqlLiteral(node));
  }
  return node.invert();
}

function subtractNodes(a: Nodes.Node[], b: Nodes.Node[]): Nodes.Node[] {
  const result: Nodes.Node[] = [];
  for (const node of a) {
    if (!b.some((other) => node.eql(other))) {
      result.push(node);
    }
  }
  return result;
}

function fetchAttribute(node: Nodes.Node): string | null {
  if ("left" in node) {
    const left = (node as any).left;
    if (left instanceof Nodes.Attribute) return left.name;
    if (left instanceof Nodes.SqlLiteral) return stripQuotes(String(left));
  }
  if (node instanceof Nodes.Not) {
    return fetchAttribute((node as any).expr);
  }
  return null;
}

function extractNodeValue(node: unknown): unknown {
  if (node instanceof Nodes.Quoted) return node.value;
  if (Array.isArray(node)) return node.map((v) => extractNodeValue(v));
  return node;
}

function stripQuotes(s: string): string {
  return s.replace(/^"(.*)"$/, "$1");
}

const visitor = new Visitors.ToSql();
