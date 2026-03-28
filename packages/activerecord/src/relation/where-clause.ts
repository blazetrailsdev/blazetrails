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
    const filtered = this.conditions.filter(
      (p) => !columns.some((col) => Object.prototype.hasOwnProperty.call(p, col)),
    );
    return new WhereClause(
      filtered,
      [...this.notConditions],
      [...this.rawClauses],
      [...this.arelNodes],
    );
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

  toH(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const cond of this.conditions) {
      Object.assign(result, cond);
    }
    return result;
  }
}
