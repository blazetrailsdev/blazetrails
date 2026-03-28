/**
 * Attribute writing methods.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Write
 */

interface Writable {
  writeAttribute(name: string, value: unknown): void;
}

/**
 * Write a raw attribute value.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Write#write_attribute
 */
export function writeAttribute(record: Writable, name: string, value: unknown): void {
  record.writeAttribute(name, value);
}
