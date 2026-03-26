/**
 * Represents a FROM clause override on a Relation.
 *
 * Mirrors: ActiveRecord::Relation::FromClause
 */
export class FromClause {
  readonly value: string | any;
  readonly name: string | null;

  constructor(value: string | any, name: string | null = null) {
    this.value = value;
    this.name = name;
  }

  get empty(): boolean {
    return this.value == null;
  }
}
