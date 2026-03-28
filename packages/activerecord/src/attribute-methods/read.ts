/**
 * Attribute reading methods.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Read
 */

interface Readable {
  readAttribute(name: string): unknown;
}

/**
 * Read an attribute value. In Base, this applies decryption and type
 * casting — use readAttributeBeforeTypeCast for raw values.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Read#read_attribute
 */
export function readAttribute(record: Readable, name: string): unknown {
  return record.readAttribute(name);
}
