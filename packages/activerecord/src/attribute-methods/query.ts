/**
 * Attribute query methods (the `attribute?` pattern from Ruby).
 *
 * Mirrors: ActiveRecord::AttributeMethods::Query
 */

import { BooleanType } from "@blazetrails/activemodel";

const booleanType = new BooleanType();

interface Queryable {
  _readAttribute(name: string): unknown;
  [key: string]: unknown;
}

/**
 * Query whether an attribute value is truthy.
 *
 * Calls the getter method by name (like Rails' public_send), so overridden
 * getters and virtual attributes are respected.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Query#query_attribute
 */
export function queryAttribute(this: Queryable, name: string): boolean {
  const prop = (this as Record<string, unknown>)[name];
  const value = typeof prop === "function" ? (prop as () => unknown).call(this) : prop;
  return castToBoolean(value);
}

/**
 * Like queryAttribute but reads via _readAttribute, bypassing alias
 * resolution — used internally where the name is already canonical.
 *
 * Mirrors: ActiveRecord::AttributeMethods::Query#_query_attribute
 */
export function _queryAttribute(this: Queryable, name: string): boolean {
  return castToBoolean(this._readAttribute(name));
}

function castToBoolean(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value !== 0;
  const cast = booleanType.cast(value);
  if (cast !== null) return cast;
  return !!value;
}
