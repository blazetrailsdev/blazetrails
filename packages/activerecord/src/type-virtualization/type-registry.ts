// Maps Rails attribute type strings to the TypeScript type the
// virtualizer writes into an injected `declare`.
//
// Two sources feed this map:
//
// 1. activemodel's `TypeRegistry` (packages/activemodel/src/type/registry.ts)
//    — the alphabet `this.attribute(name, type)` accepts at runtime.
//    Every key registered there needs a matching entry here so the
//    virtualizer can emit the right declare for a user-declared
//    attribute.
//
// 2. Adapter schema dumps (schema-columns JSON passed via `--schema`).
//    PostgreSQL emits Rails type names like `text`, `timestamp`, `jsonb`,
//    `hstore`, `inet`, `cidr`, `citext` from its column introspection.
//    These keys are SCHEMA-DUMP-ONLY: they're never passed to
//    `this.attribute(...)` (that would throw at runtime — activemodel's
//    registry doesn't know them). The virtualizer maps them to TS types
//    only for the compile-time declare produced from schema reflection.

export const ATTRIBUTE_TYPE_MAP: Record<string, string> = {
  string: "string",
  text: "string",
  immutable_string: "string",
  uuid: "string",
  inet: "string",
  cidr: "string",
  citext: "string",
  integer: "number",
  big_integer: "number",
  float: "number",
  decimal: "number",
  boolean: "boolean",
  date: "Date",
  datetime: "Date",
  timestamp: "Date",
  time: "Date",
  json: "unknown",
  jsonb: "unknown",
  // hstore values are nullable at runtime (see
  // connection-adapters/postgresql/oid/hstore.ts), so the compile-time
  // type allows null values too.
  hstore: "Record<string, string | null>",
  binary: "Uint8Array",
  array: "unknown[]",
  value: "unknown",
};

export function tsTypeFor(railsType: string): string {
  return ATTRIBUTE_TYPE_MAP[railsType] ?? "unknown";
}
