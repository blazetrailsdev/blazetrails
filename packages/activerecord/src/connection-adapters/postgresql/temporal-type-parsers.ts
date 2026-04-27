/**
 * Per-connection Temporal type parsers for the pg driver.
 *
 * pg's default OID parsers decode timestamp/date columns into JS Date
 * objects, losing microsecond precision. By passing `{ types: { getTypeParser } }`
 * to `new pg.Pool(...)` we redirect those OIDs to our wire parsers, which
 * return Temporal types with full precision.
 *
 * We deliberately do NOT call `pg.types.setTypeParser` — that mutates a
 * process-global registry shared with drizzle, pg-boss, raw pg.Client users,
 * etc. Per-connection tables, not global mutation.
 */

import {
  parsePostgresInstant,
  parsePostgresPlainDateTime,
  parsePostgresDate,
  parsePostgresTime,
  parsePostgresTimeTz,
} from "../abstract/temporal-wire.js";

// PostgreSQL OIDs for the temporal types we intercept.
const OID_DATE = 1082;
const OID_TIME = 1083;
const OID_TIMESTAMP = 1114;
const OID_TIMESTAMPTZ = 1184;
const OID_TIMETZ = 1266;

type PgParser = (value: string) => unknown;

const TEMPORAL_PARSERS: ReadonlyMap<number, PgParser> = new Map<number, PgParser>([
  [OID_TIMESTAMPTZ, (v) => parsePostgresInstant(v)],
  [OID_TIMESTAMP, (v) => parsePostgresPlainDateTime(v)],
  [OID_DATE, (v) => parsePostgresDate(v)],
  [OID_TIME, (v) => parsePostgresTime(v)],
  [OID_TIMETZ, (v) => parsePostgresTimeTz(v)],
]);

/**
 * Drop-in replacement for `pg.types.getTypeParser`.
 * Pass as `{ types: { getTypeParser } }` in the pg.Pool / pg.Client config.
 *
 * Only intercepts text-format (`format === 'text'`) for the five temporal
 * OIDs. Everything else falls through to the default pg parser via `null`,
 * which pg interprets as "use the built-in default for this OID".
 */
export function getTypeParser(oid: number, format?: string): PgParser | null {
  if (format === "text" || format === undefined) {
    const parser = TEMPORAL_PARSERS.get(oid);
    if (parser) return parser;
  }
  return null;
}
