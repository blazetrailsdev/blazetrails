/**
 * PostgreSQL vector type — used for pgvector extension.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Vector
 */

export class Vector {
  readonly delim: string;
  readonly subtype: unknown;

  constructor(delim: string = ",", subtype: unknown = null) {
    this.delim = delim;
    this.subtype = subtype;
  }

  get type(): string {
    return "vector";
  }

  cast(value: unknown): unknown {
    return value;
  }

  serialize(value: unknown): unknown {
    return value;
  }

  deserialize(value: unknown): unknown {
    return this.cast(value);
  }
}
