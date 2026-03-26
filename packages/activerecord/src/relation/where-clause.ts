import type { Nodes } from "@rails-ts/arel";

/**
 * Represents the WHERE conditions on a Relation. Encapsulates
 * hash conditions, NOT conditions, raw SQL, and Arel nodes.
 *
 * Mirrors: ActiveRecord::Relation::WhereClause
 */
export class WhereClause {
  readonly hashConditions: Array<Record<string, unknown>>;
  readonly notConditions: Array<Record<string, unknown>>;
  readonly rawClauses: string[];
  readonly arelNodes: Nodes.Node[];

  constructor(
    hashConditions: Array<Record<string, unknown>> = [],
    notConditions: Array<Record<string, unknown>> = [],
    rawClauses: string[] = [],
    arelNodes: Nodes.Node[] = [],
  ) {
    this.hashConditions = hashConditions;
    this.notConditions = notConditions;
    this.rawClauses = rawClauses;
    this.arelNodes = arelNodes;
  }

  get empty(): boolean {
    return (
      this.hashConditions.length === 0 &&
      this.notConditions.length === 0 &&
      this.rawClauses.length === 0 &&
      this.arelNodes.length === 0
    );
  }

  addHash(conditions: Record<string, unknown>): WhereClause {
    return new WhereClause(
      [...this.hashConditions, conditions],
      this.notConditions,
      this.rawClauses,
      this.arelNodes,
    );
  }

  addNot(conditions: Record<string, unknown>): WhereClause {
    return new WhereClause(
      this.hashConditions,
      [...this.notConditions, conditions],
      this.rawClauses,
      this.arelNodes,
    );
  }

  addRaw(sql: string): WhereClause {
    return new WhereClause(
      this.hashConditions,
      this.notConditions,
      [...this.rawClauses, sql],
      this.arelNodes,
    );
  }

  addArelNode(node: Nodes.Node): WhereClause {
    return new WhereClause(this.hashConditions, this.notConditions, this.rawClauses, [
      ...this.arelNodes,
      node,
    ]);
  }

  merge(other: WhereClause): WhereClause {
    return new WhereClause(
      [...this.hashConditions, ...other.hashConditions],
      [...this.notConditions, ...other.notConditions],
      [...this.rawClauses, ...other.rawClauses],
      [...this.arelNodes, ...other.arelNodes],
    );
  }

  except(...columns: string[]): WhereClause {
    const filtered = this.hashConditions
      .map((cond) => {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(cond)) {
          if (!columns.includes(key)) result[key] = value;
        }
        return result;
      })
      .filter((cond) => Object.keys(cond).length > 0);
    return new WhereClause(filtered, this.notConditions, this.rawClauses, this.arelNodes);
  }
}
