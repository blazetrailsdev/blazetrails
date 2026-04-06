/**
 * WhereClause — manages the collection of WHERE conditions on a Relation.
 *
 * Encapsulates the four parallel condition arrays that Relation uses:
 * object conditions, negated conditions, raw SQL strings, and Arel nodes.
 *
 * Mirrors: ActiveRecord::Relation::WhereClause
 */

import { Visitors, Nodes } from "@blazetrails/arel";
import { quote, quoteTableName } from "../connection-adapters/abstract/quoting.js";

export class WhereClause {
  conditions: Array<Record<string, unknown>>;
  notConditions: Array<Record<string, unknown>>;
  rawClauses: string[];
  arelNodes: Nodes.Node[];

  constructor(
    conditions: Array<Record<string, unknown>> = [],
    notConditions: Array<Record<string, unknown>> = [],
    rawClauses: string[] = [],
    arelNodes: Nodes.Node[] = [],
  ) {
    this.conditions = conditions;
    this.notConditions = notConditions;
    this.rawClauses = rawClauses;
    this.arelNodes = arelNodes;
  }

  static empty(): WhereClause {
    return new WhereClause();
  }

  isEmpty(): boolean {
    return (
      this.conditions.length === 0 &&
      this.notConditions.length === 0 &&
      this.rawClauses.length === 0 &&
      this.arelNodes.length === 0
    );
  }

  merge(other: WhereClause): WhereClause {
    return new WhereClause(
      [...this.conditions, ...other.conditions],
      [...this.notConditions, ...other.notConditions],
      [...this.rawClauses, ...other.rawClauses],
      [...this.arelNodes, ...other.arelNodes],
    );
  }

  invert(): WhereClause {
    const allPredicates = this.predicateNodes();
    if (allPredicates.length === 0) return this.clone();
    if (allPredicates.length === 1) {
      return new WhereClause([], [], [], [invertPredicate(allPredicates[0])]);
    }
    const ast = new Nodes.And(allPredicates);
    return new WhereClause([], [], [], [new Nodes.Not(ast)]);
  }

  except(...columns: string[]): WhereClause {
    const colSet = new Set(columns);
    const filtered = this.conditions
      .map((clause) => {
        const kept: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(clause)) {
          if (!colSet.has(k)) kept[k] = v;
        }
        return kept;
      })
      .filter((clause) => Object.keys(clause).length > 0);
    const filteredNot = this.notConditions
      .map((clause) => {
        const kept: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(clause)) {
          if (!colSet.has(k)) kept[k] = v;
        }
        return kept;
      })
      .filter((clause) => Object.keys(clause).length > 0);
    return new WhereClause(filtered, filteredNot, [...this.rawClauses], [...this.arelNodes]);
  }

  clear(): void {
    this.conditions.length = 0;
    this.notConditions.length = 0;
    this.rawClauses.length = 0;
    this.arelNodes.length = 0;
  }

  clone(): WhereClause {
    return new WhereClause(
      [...this.conditions],
      [...this.notConditions],
      [...this.rawClauses],
      [...this.arelNodes],
    );
  }

  or(other: WhereClause): WhereClause {
    if (this.isEmpty()) return other.clone();
    if (other.isEmpty()) return this.clone();

    let left = this.astNode();
    if (left instanceof Nodes.Grouping) left = (left as any).expr;
    let right = other.astNode();
    if (right instanceof Nodes.Grouping) right = (right as any).expr;

    const orNode =
      left instanceof Nodes.Or
        ? new Nodes.Or([...(left as any).children, right])
        : new Nodes.Or([left, right]);

    return new WhereClause([], [], [], [new Nodes.Grouping(orNode)]);
  }

  get ast(): string {
    return clauseToAstString(this);
  }

  astNode(): Nodes.Node {
    const predicates = this.predicateNodes();
    return predicates.length === 1 ? predicates[0] : new Nodes.And(predicates);
  }

  predicateNodes(): Nodes.Node[] {
    const nodes: Nodes.Node[] = [];
    for (const cond of this.conditions) {
      for (const [k, v] of Object.entries(cond)) {
        nodes.push(conditionToArelNode(k, v, false));
      }
    }
    for (const cond of this.notConditions) {
      for (const [k, v] of Object.entries(cond)) {
        nodes.push(conditionToArelNode(k, v, true));
      }
    }
    for (const raw of this.rawClauses) {
      nodes.push(new Nodes.SqlLiteral(raw));
    }
    nodes.push(...this.arelNodes);
    return nodes;
  }

  isContradiction(): boolean {
    for (const cond of this.conditions) {
      for (const value of Object.values(cond)) {
        if (Array.isArray(value) && value.length === 0) return true;
      }
    }
    for (const node of this.arelNodes) {
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
    for (const cond of this.conditions) {
      attrs.push(...Object.keys(cond));
    }
    for (const cond of this.notConditions) {
      attrs.push(...Object.keys(cond));
    }
    return attrs;
  }

  toH(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const cond of this.conditions) {
      Object.assign(result, cond);
    }
    return result;
  }
}

function conditionToArelNode(key: string, value: unknown, negate: boolean): Nodes.Node {
  const col = new Nodes.SqlLiteral(quoteTableName(key));
  if (value === null || value === undefined) {
    const eq = new Nodes.Equality(col, null as any);
    return negate ? new Nodes.Not(eq) : eq;
  }
  if (Array.isArray(value)) {
    const node = new Nodes.In(col, new Nodes.Quoted(value) as any);
    return negate ? new Nodes.Not(node) : node;
  }
  const eq = new Nodes.Equality(col, new Nodes.Quoted(value));
  return negate ? new Nodes.Not(eq) : eq;
}

function invertPredicate(node: Nodes.Node): Nodes.Node {
  return node.invert();
}

const visitor = new Visitors.ToSql();

function clauseToAstString(clause: WhereClause): string {
  const parts: string[] = [];
  for (const cond of clause.conditions) {
    for (const [k, v] of Object.entries(cond)) {
      const col = quoteTableName(k);
      if (v === null || v === undefined) {
        parts.push(`${col} IS NULL`);
      } else if (Array.isArray(v)) {
        const nonNull = v.filter((x) => x !== null && x !== undefined);
        const hasNull = nonNull.length !== v.length;
        if (nonNull.length === 0 && !hasNull) {
          parts.push("1=0");
        } else {
          const sub: string[] = [];
          if (nonNull.length > 0)
            sub.push(`${col} IN (${nonNull.map((x) => quote(x)).join(", ")})`);
          if (hasNull) sub.push(`${col} IS NULL`);
          parts.push(sub.length === 1 ? sub[0] : `(${sub.join(" OR ")})`);
        }
      } else {
        parts.push(`${col} = ${quote(v)}`);
      }
    }
  }
  for (const cond of clause.notConditions) {
    for (const [k, v] of Object.entries(cond)) {
      const col = quoteTableName(k);
      if (v === null || v === undefined) {
        parts.push(`${col} IS NOT NULL`);
      } else if (Array.isArray(v)) {
        const nonNull = v.filter((x) => x !== null && x !== undefined);
        const hasNull = nonNull.length !== v.length;
        if (nonNull.length === 0 && !hasNull) {
          parts.push("1=1");
        } else {
          if (nonNull.length > 0)
            parts.push(`${col} NOT IN (${nonNull.map((x) => quote(x)).join(", ")})`);
          if (hasNull) parts.push(`${col} IS NOT NULL`);
        }
      } else {
        parts.push(`${col} != ${quote(v)}`);
      }
    }
  }
  parts.push(...clause.rawClauses);
  for (const node of clause.arelNodes) {
    try {
      parts.push(visitor.compile(node));
    } catch {
      parts.push(String(node));
    }
  }
  return parts.length <= 1 ? (parts[0] ?? "") : parts.join(" AND ");
}
