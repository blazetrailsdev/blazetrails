/**
 * Sentinel values for Postgres out-of-range datetime literals.
 * Postgres can return 'infinity' / '-infinity' for timestamp/date columns;
 * these have no Temporal equivalent.
 */

export const DateInfinity: unique symbol = Symbol("DateInfinity");
export const DateNegativeInfinity: unique symbol = Symbol("DateNegativeInfinity");

export type DateInfinity = typeof DateInfinity;
export type DateNegativeInfinity = typeof DateNegativeInfinity;

export function isDateInfinity(v: unknown): v is DateInfinity {
  return v === DateInfinity;
}

export function isDateNegativeInfinity(v: unknown): v is DateNegativeInfinity {
  return v === DateNegativeInfinity;
}
