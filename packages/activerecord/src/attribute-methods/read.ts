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
 * Mirrors: ActiveRecord::AttributeMethods::Read#_read_attribute
 */
export function _readAttribute(this: AttributeHolder, name: string): unknown {
  return this._attributes.fetchValue(name) ?? null;
}
