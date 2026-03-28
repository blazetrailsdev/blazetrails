/**
 * Primary key attribute methods.
 *
 * Mirrors: ActiveRecord::AttributeMethods::PrimaryKey
 */

interface PrimaryKeyRecord {
  id: unknown;
  readAttribute(name: string): unknown;
  constructor: Function & { primaryKey: string | string[] };
}

/**
 * Return an array of primary key values for this record, or null if unsaved.
 *
 * Mirrors: ActiveRecord::AttributeMethods::PrimaryKey#to_key
 */
export function toKey(record: PrimaryKeyRecord): unknown[] | null {
  const pk = record.id;
  return pk != null ? [pk] : null;
}

/**
 * Check whether all primary key values are present.
 *
 * Mirrors: ActiveRecord::AttributeMethods::PrimaryKey#primary_key_values_present?
 */
export function isPrimaryKeyValuesPresent(record: PrimaryKeyRecord): boolean {
  const pk = (record.constructor as any).primaryKey;
  if (Array.isArray(pk)) {
    return pk.every((col: string) => {
      const v = record.readAttribute(col);
      return v !== null && v !== undefined;
    });
  }
  return record.id != null;
}
