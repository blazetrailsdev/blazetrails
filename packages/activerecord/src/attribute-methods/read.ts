/**
 * Attribute reading methods.
 *
 * The actual readAttribute implementation lives on Model (from
 * @blazetrails/activemodel). This module exists to match the Rails
 * file structure for ActiveRecord::AttributeMethods::Read.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Read
 */

import type { AttributeSet } from "@blazetrails/activemodel";

/**
 * The Read module interface.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Read
 */
export interface Read {
  readAttribute(name: string): unknown;
  _readAttribute(name: string): unknown;
}

interface AttributeHolder {
  _attributes: AttributeSet;
}

/**
 * Skips alias resolution and the primary-key "id" redirect — used internally
 * where attribute names are already canonical.
 *
 * In Rails, `_read_attribute` returns the deserialized value because
 * serialization lives inside the attribute type. In this codebase,
 * serialize.ts patches `readAttribute` at the model level, so
 * `_readAttribute` bypasses that patch and returns the raw stored value
 * for serialized columns. This matches Rails' intent; the gap is architectural.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Read#_read_attribute
 */
export function _readAttribute(this: AttributeHolder, name: string): unknown {
  return this._attributes.fetchValue(name) ?? null;
}
