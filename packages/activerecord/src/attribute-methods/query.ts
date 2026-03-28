/**
 * Attribute query methods (the `attribute?` pattern from Ruby).
 *
 * Mirrors: ActiveRecord::AttributeMethods::Query
 */

interface Queryable {
  readAttribute(name: string): unknown;
}

/**
 * Query whether an attribute value is truthy.
 * Equivalent to Ruby's `record.attribute?` pattern.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Query#query_attribute
 */
export function queryAttribute(record: Queryable, name: string): boolean {
  const value = record.readAttribute(name);
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (value === "" || value === "0" || value === "false" || value === "f") return false;
    return true;
  }
  return !!value;
}
