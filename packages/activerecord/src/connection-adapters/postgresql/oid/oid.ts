/**
 * PostgreSQL OID type — object identifier.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Oid.
 * Rails: `class Oid < Type::UnsignedInteger`. We don't yet have an
 * UnsignedIntegerType in activemodel, so extend IntegerType and add a
 * signed-range rejection in cast to approximate unsigned semantics.
 */

import { IntegerType } from "@blazetrails/activemodel";

export class Oid extends IntegerType {
  override readonly name: string = "oid";

  override type(): string {
    return "oid";
  }

  override cast(value: unknown): number | null {
    const cast = super.cast(value);
    // Rails' UnsignedInteger rejects negatives; PG OIDs are unsigned 32-bit.
    if (cast != null && cast < 0) return null;
    return cast;
  }
}
