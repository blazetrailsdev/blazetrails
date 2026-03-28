/**
 * FromClause — tracks the FROM source on a Relation.
 *
 * Mirrors: ActiveRecord::Relation::FromClause
 */

export class FromClause {
  readonly value: string | null;
  readonly name: string | null;

  constructor(value: string | null = null, name: string | null = null) {
    this.value = value;
    this.name = name;
  }

  static empty(): FromClause {
    return new FromClause();
  }

  isEmpty(): boolean {
    return this.value === null;
  }

  merge(other: FromClause): FromClause {
    if (!other.isEmpty()) return other;
    return this;
  }

  equals(other: FromClause): boolean {
    return this.value === other.value && this.name === other.name;
  }
}
