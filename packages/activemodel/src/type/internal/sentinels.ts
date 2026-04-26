/**
 * Sentinel values for Postgres out-of-range datetime literals.
 * Postgres can return 'infinity' / '-infinity' for timestamp/date columns;
 * these have no Temporal equivalent.
 */

export const DateInfinity = Symbol.for("@blazetrails/activemodel:DateInfinity");
export const DateNegativeInfinity = Symbol.for("@blazetrails/activemodel:DateNegativeInfinity");

export type DateInfinity = typeof DateInfinity;
export type DateNegativeInfinity = typeof DateNegativeInfinity;

export function isDateInfinity(v: unknown): v is DateInfinity {
  return v === DateInfinity;
}

export function isDateNegativeInfinity(v: unknown): v is DateNegativeInfinity {
  return v === DateNegativeInfinity;
}
