/**
 * Access attribute values before type casting.
 *
 * The actual implementation lives on Model (from @blazetrails/activemodel)
 * as readAttributeBeforeTypeCast() and attributesBeforeTypeCast getter,
 * which read valueBeforeTypeCast from the AttributeSet.
 *
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast
 */

interface BeforeTypeCastRecord {
  readAttributeBeforeTypeCast(name: string): unknown;
  readonly attributesBeforeTypeCast: Record<string, unknown>;
}

/**
 * Read the attribute value before type casting.
 *
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast#read_attribute_before_type_cast
 */
export function readAttributeBeforeTypeCast(record: BeforeTypeCastRecord, name: string): unknown {
  return record.readAttributeBeforeTypeCast(name);
}

/**
 * Return all attribute values before type casting.
 *
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast#attributes_before_type_cast
 */
export function attributesBeforeTypeCast(record: BeforeTypeCastRecord): Record<string, unknown> {
  return record.attributesBeforeTypeCast;
}

interface DatabaseRecord {
  _attributes: {
    valueForDatabase?(name: string): unknown;
    valuesForDatabase?(): Record<string, unknown>;
    get?(name: string): { valueForDatabase?(): unknown } | undefined;
    [key: string]: unknown;
  };
  readAttribute(name: string): unknown;
  constructor: { _attributeAliases?: Record<string, string> };
}

/**
 * Rails: resolves alias, then calls attribute_for_database(name)
 * which reads the serialized-for-database value from the attribute set.
 */
export function readAttributeForDatabase(record: DatabaseRecord, attrName: string): unknown {
  const name = record.constructor._attributeAliases?.[attrName] ?? attrName;
  // Try the attribute's valueForDatabase (matches Rails' @attributes[name].value_for_database)
  const attr = record._attributes.get?.(name);
  if (attr?.valueForDatabase) return attr.valueForDatabase();
  if (record._attributes.valueForDatabase) return record._attributes.valueForDatabase(name);
  return record.readAttribute(name);
}

/**
 * Rails: @attributes.values_for_database
 */
export function attributesForDatabase(record: DatabaseRecord): Record<string, unknown> {
  if (record._attributes.valuesForDatabase) {
    return record._attributes.valuesForDatabase();
  }
  // Fallback: serialize each attribute individually
  const result: Record<string, unknown> = {};
  if (record._attributes.get) {
    for (const [key] of Object.entries(record._attributes)) {
      if (key.startsWith("_")) continue;
      result[key] = readAttributeForDatabase(record, key);
    }
  }
  return result;
}
