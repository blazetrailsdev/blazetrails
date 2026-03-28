/**
 * Access attribute values before type casting.
 *
 * Note: full before-type-cast support requires AttributeSet to expose
 * valueBeforeTypeCast per attribute. These helpers currently return the
 * stored value from the attribute set, which may already be cast.
 *
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast
 */

interface TypeCastable {
  _attributes: { get(name: string): unknown; keys(): Iterable<string> };
}

/**
 * Read the attribute value as stored in the attribute set.
 *
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast#read_attribute_before_type_cast
 */
export function readAttributeBeforeTypeCast(record: TypeCastable, name: string): unknown {
  return record._attributes.get(name);
}

/**
 * Return all attribute values as stored in the attribute set.
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
