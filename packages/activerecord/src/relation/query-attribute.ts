/**
 * QueryAttribute — an attribute value used in query predicates.
 *
 * Wraps a value with its type for proper casting in WHERE clauses.
 * Used by the PredicateBuilder when constructing query conditions.
 *
 * Mirrors: ActiveRecord::Relation::QueryAttribute
 */

interface CastType {
  cast(value: unknown): unknown;
  serialize?(value: unknown): unknown;
}

export class QueryAttribute {
  readonly name: string;
  readonly valueBeforeTypeCast: unknown;
  readonly type: CastType;

  constructor(name: string, value: unknown, type: CastType) {
    this.name = name;
    this.valueBeforeTypeCast = value;
    this.type = type;
  }

  get value(): unknown {
    return this.type.cast(this.valueBeforeTypeCast);
  }

  typeCast(): unknown {
    return this.value;
  }

  valueForDatabase(): unknown {
    if (this.type.serialize) {
      return this.type.serialize(this.value);
    }
    return this.value;
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
