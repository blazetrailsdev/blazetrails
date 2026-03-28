/**
 * Attribute writing methods.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Write
 */

interface Writable {
  writeAttribute(name: string, value: unknown): void;
}

/**
 * Write an attribute value. In Base, this validates the attribute name,
 * checks for frozen state, and applies encryption.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Write#write_attribute
 */
export function writeAttribute(record: Writable, name: string, value: unknown): void {
  record.writeAttribute(name, value);
}
