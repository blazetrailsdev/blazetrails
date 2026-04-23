/**
 * Attribute writing methods.
 *
 * The actual writeAttribute implementation lives on Model (from
 * @blazetrails/activemodel), with Base adding encryption and frozen
 * checks. This module exists to match the Rails file structure for
 * ActiveRecord::AttributeMethods::Write.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Write
 */

import { Model } from "@blazetrails/activemodel";

/**
 * The Write module interface.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Write
 */
export interface Write {
  writeAttribute(name: string, value: unknown): void;
  _writeAttribute(name: string, value: unknown): void;
}

/**
 * Skips the primary-key "id" redirect and AR's readonly/frozen checks.
 * Used internally where the attribute name is already canonical.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Write#_write_attribute
 */
export function _writeAttribute(this: Model, name: string, value: unknown): void {
  Model.prototype.writeAttribute.call(this, name, value);
}
