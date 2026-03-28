/**
 * AttributeMethods — methods for working with model attributes.
 *
 * Mirrors: ActiveRecord::AttributeMethods
 */

/**
 * The AttributeMethods module interface.
 *
 * Mirrors: ActiveRecord::AttributeMethods
 */
export interface AttributeMethods {
  hasAttribute(name: string): boolean;
  attributePresent(name: string): boolean;
  attributeNamesList: string[];
}

interface AttributeRecord {
  _attributes: { has(name: string): boolean; keys(): Iterable<string>; get(name: string): unknown };
  _accessedFields: Set<string>;
  readAttribute(name: string): unknown;
}

/**
 * Check whether an attribute exists on a record.
 *
 * Mirrors: ActiveRecord::AttributeMethods#has_attribute?
 */
export function hasAttribute(record: AttributeRecord, name: string): boolean {
  return record._attributes.has(name);
}

/**
 * Check whether an attribute is present (not null, not undefined, not empty string).
 *
 * Mirrors: ActiveRecord::AttributeMethods#attribute_present?
 */
export function isAttributePresent(record: AttributeRecord, name: string): boolean {
  const value = record.readAttribute(name);
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

/**
 * Return all attribute names for a record.
 *
 * Mirrors: ActiveRecord::AttributeMethods#attribute_names
 */
export function attributeNames(record: AttributeRecord): string[] {
  return [...record._attributes.keys()];
}

/**
 * Return all attributes as a plain object.
 *
 * Mirrors: ActiveRecord::AttributeMethods#attributes
 */
export function attributes(record: AttributeRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of record._attributes.keys()) {
    result[key] = record.readAttribute(key);
  }
  return result;
}

/**
 * Return the list of attribute names that have been read on this record.
 * Useful for identifying unused columns to optimize SELECT queries.
 *
 * Mirrors: ActiveRecord::AttributeMethods#accessed_fields
 */
export function accessedFields(record: AttributeRecord): string[] {
  return [...record._accessedFields];
}

/**
 * Generated attribute methods placeholder.
 * Model classes mix dynamically-generated accessors into this module.
 *
 * Mirrors: ActiveRecord::AttributeMethods::GeneratedAttributeMethods
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GeneratedAttributeMethods {}
