/**
 * PostgreSQL vector type — used for composite/pgvector columns.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Vector.
 * Rails: `class Vector < Type::Value`. Only implements cast (as identity
 * — the class carries the FIXME that it should split on delim and use
 * subtype.cast, but current Rails behavior is the raw passthrough).
 */

import { Type } from "@blazetrails/activemodel";

export class Vector extends Type<unknown> {
  readonly name: string = "vector";
  readonly delim: string;
  readonly subtype: unknown;

  constructor(delim: string, subtype: unknown) {
    super();
    this.delim = delim;
    this.subtype = subtype;
  }

  override type(): string {
    // Rails doesn't override `def type` on Vector; it inherits from
    // Type::Value which returns nil. Return "vector" here so TS
    // callers that inspect type() get a useful identifier.
    return "vector";
  }

  cast(value: unknown): unknown {
    // Rails: `def cast(value); value; end`. Matches the FIXME'd
    // passthrough exactly.
    return value;
  }
}
