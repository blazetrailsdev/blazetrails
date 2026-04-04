/**
 * WhereClause — manages the collection of WHERE conditions on a Relation.
 *
 * Encapsulates the four parallel condition arrays that Relation uses:
 * object conditions, negated conditions, raw SQL strings, and Arel nodes.
 *
 * Mirrors: ActiveRecord::Relation::WhereClause
 */

import type { Nodes } from "@blazetrails/arel";

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
    return new WhereClause(
      [...this.notConditions],
      [...this.conditions],
      [...this.rawClauses],
      [...this.arelNodes],
    );
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
    const combined = this.merge(other);
    combined.rawClauses = [];
    const leftParts = [
      ...this.conditions.map(
        (c) =>
          `(${Object.entries(c)
            .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
            .join(" AND ")})`,
      ),
      ...this.notConditions.map(
        (c) =>
          `NOT (${Object.entries(c)
            .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
            .join(" AND ")})`,
      ),
      ...this.rawClauses,
    ].filter(Boolean);
    const rightParts = [
      ...other.conditions.map(
        (c) =>
          `(${Object.entries(c)
            .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
            .join(" AND ")})`,
      ),
      ...other.notConditions.map(
        (c) =>
          `NOT (${Object.entries(c)
            .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
            .join(" AND ")})`,
      ),
      ...other.rawClauses,
    ].filter(Boolean);
    const left = leftParts.join(" AND ");
    const right = rightParts.join(" AND ");
    return new WhereClause([], [], [`(${left}) OR (${right})`]);
  }

  get ast(): string {
    const parts: string[] = [];
    for (const cond of this.conditions) {
      for (const [k, v] of Object.entries(cond)) {
        parts.push(`${k} = ${JSON.stringify(v)}`);
      }
    }
    for (const cond of this.notConditions) {
      for (const [k, v] of Object.entries(cond)) {
        parts.push(`${k} != ${JSON.stringify(v)}`);
      }
    }
    parts.push(...this.rawClauses);
    return parts.length <= 1 ? (parts[0] ?? "") : parts.join(" AND ");
  }

  isContradiction(): boolean {
    for (const cond of this.conditions) {
      for (const value of Object.values(cond)) {
        if (Array.isArray(value) && value.length === 0) return true;
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
