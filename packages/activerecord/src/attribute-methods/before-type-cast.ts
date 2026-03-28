/**
 * Access attribute values before type casting.
 *
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast
 */

interface TypeCastable {
  _attributes: { get(name: string): unknown; keys(): Iterable<string> };
  readAttribute(name: string): unknown;
}

/**
 * Read the raw attribute value before type casting.
 *
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast#read_attribute_before_type_cast
 */
export function readAttributeBeforeTypeCast(record: TypeCastable, name: string): unknown {
  return record._attributes.get(name);
}

/**
 * Return all attributes before type casting.
 *
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast#attributes_before_type_cast
 */
export function attributesBeforeTypeCast(record: TypeCastable): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of record._attributes.keys()) {
    result[key] = record._attributes.get(key);
  }
  return result;
}
