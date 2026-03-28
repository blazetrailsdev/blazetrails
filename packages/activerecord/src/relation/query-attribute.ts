/**
 * QueryAttribute — an attribute value used in query predicates.
 *
 * Wraps a value with its type for proper casting in WHERE clauses.
 *
 * Mirrors: ActiveRecord::Relation::QueryAttribute
 */

export class QueryAttribute {
  readonly name: string;
  readonly valueBeforeTypeCast: unknown;
  readonly type: { cast(value: unknown): unknown };

  constructor(name: string, value: unknown, type: { cast(value: unknown): unknown }) {
    this.name = name;
    this.valueBeforeTypeCast = value;
    this.type = type;
  }

  typeCast(): unknown {
    return this.type.cast(this.valueBeforeTypeCast);
  }

  valueForDatabase(): unknown {
    return this.typeCast();
  }

  withCastValue(value: unknown): QueryAttribute {
    return new QueryAttribute(this.name, value, this.type);
  }

  isNil(): boolean {
    return this.valueBeforeTypeCast === null || this.valueBeforeTypeCast === undefined;
  }

  isInfinite(): boolean {
    const v = this.valueBeforeTypeCast;
    return v === Infinity || v === -Infinity;
  }

  isUnboundable(): boolean {
    return false;
  }

  equals(other: QueryAttribute): boolean {
    return this.name === other.name && this.valueBeforeTypeCast === other.valueBeforeTypeCast;
  }
}
