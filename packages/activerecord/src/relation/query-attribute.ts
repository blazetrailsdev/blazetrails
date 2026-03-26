/**
 * An attribute value with type information, used in query binding.
 *
 * Mirrors: ActiveRecord::Relation::QueryAttribute
 */
export class QueryAttribute {
  readonly name: string;
  readonly valueBeforeTypeCast: unknown;
  readonly type: any;

  constructor(name: string, value: unknown, type?: any) {
    this.name = name;
    this.valueBeforeTypeCast = value;
    this.type = type;
  }

  get value(): unknown {
    if (this.type && typeof this.type.cast === "function") {
      return this.type.cast(this.valueBeforeTypeCast);
    }
    return this.valueBeforeTypeCast;
  }
}
