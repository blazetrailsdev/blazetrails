/**
 * Attribute reading methods.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Read
 */

interface Readable {
  readAttribute(name: string): unknown;
}

/**
 * Read a raw attribute value, bypassing any type casting.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Read#read_attribute
 */
export function readAttribute(record: Readable, name: string): unknown {
  return record.readAttribute(name);
}
