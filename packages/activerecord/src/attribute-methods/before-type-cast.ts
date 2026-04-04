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
  _attributes: { valuesForDatabase?(): Record<string, unknown>; [key: string]: unknown };
  readAttribute(name: string): unknown;
  constructor: { _attributeAliases?: Record<string, string> };
}

/**
 * Read the attribute value serialized for the database.
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast#read_attribute_for_database
 */
export function readAttributeForDatabase(record: DatabaseRecord, attrName: string): unknown {
  const name = record.constructor._attributeAliases?.[attrName] ?? attrName;
  const attrs = record._attributes;
  if (attrs.valuesForDatabase) {
    return attrs.valuesForDatabase()[name];
  }
  return record.readAttribute(name);
}

/**
 * Return all attribute values serialized for the database.
 * Mirrors: ActiveRecord::AttributeMethods::BeforeTypeCast#attributes_for_database
 */
export function attributesForDatabase(record: DatabaseRecord): Record<string, unknown> {
  if (record._attributes.valuesForDatabase) {
    return record._attributes.valuesForDatabase();
  }
  return {};
}
