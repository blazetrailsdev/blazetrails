/**
 * WhereClause — manages the collection of WHERE conditions on a Relation.
 *
 * Mirrors: ActiveRecord::Relation::WhereClause
 */

export class WhereClause {
  readonly predicates: unknown[];

  constructor(predicates: unknown[] = []) {
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

  except(...columns: string[]): WhereClause {
    const filtered = this.predicates.filter((p) => {
      if (typeof p === "object" && p !== null) {
        return !columns.some((col) => col in (p as Record<string, unknown>));
      }
      return true;
    });
    return new WhereClause(filtered);
  }

  or(other: WhereClause): WhereClause {
    return new WhereClause([...this.predicates, ...other.predicates]);
  }

  toH(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const pred of this.predicates) {
      if (typeof pred === "object" && pred !== null) {
        Object.assign(result, pred);
      }
    }
    return result;
  }
}
