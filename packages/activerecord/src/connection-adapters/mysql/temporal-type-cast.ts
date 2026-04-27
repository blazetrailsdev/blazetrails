/**
 * Per-connection Temporal typeCast callback for the mysql2 driver.
 *
 * mysql2's default field decoder converts DATETIME/TIMESTAMP/DATE/TIME
 * columns into JS Date objects, losing microsecond precision. Passing
 * `{ dateStrings: true, typeCast }` to `mysql.createPool` makes the
 * driver emit raw strings for those field types, and this callback
 * converts them to the appropriate Temporal type.
 *
 * Precondition: the connection's `@@session.time_zone` must be `'+00:00'`
 * (enforced via a post-connect `SET time_zone = '+00:00'`). Without this,
 * TIMESTAMP strings are emitted in the server's session timezone and
 * parseMysqlInstant would silently produce wrong instants.
 *
 * We deliberately do NOT call any global mysql2 type registration — that
 * would mutate a process-wide registry shared with other mysql2 users.
 */

import mysql from "mysql2/promise";
import {
  parseMysqlInstant,
  parseMysqlPlainDateTime,
  parseMysqlDate,
  parseMysqlTime,
} from "../abstract/temporal-wire.js";

// mysql2 field type IDs for temporal columns.
// Text protocol (COM_QUERY): 7/10/11/12/14.
// Binary protocol (COM_STMT_EXECUTE / prepared statements): MySQL 5.6+
// uses _V2 variants (17/18/19) for fractional-second columns.  Both sets
// are handled so the callback works regardless of which protocol executes.
const TYPE_TIMESTAMP = 7;
const TYPE_DATE = 10;
const TYPE_TIME = 11;
const TYPE_DATETIME = 12;
const TYPE_NEWDATE = 14;
const TYPE_TIMESTAMP2 = 17; // TIMESTAMP(N) in binary protocol
const TYPE_DATETIME2 = 18; // DATETIME(N) in binary protocol
const TYPE_TIME2 = 19; // TIME(N) in binary protocol

type Field = { type: number };
type NextFn = () => unknown;

/**
 * mysql2 `typeCast` callback. Pass as `{ typeCast }` in pool/connection
 * options alongside `{ dateStrings: true }`.
 *
 * Returns Temporal types for temporal fields; delegates all other fields
 * to the driver default via `next()`.
 */
export function temporalTypeCast(field: Field, next: NextFn): unknown {
  const str = (field as unknown as { string: () => string | null }).string;
  switch (field.type) {
    case TYPE_TIMESTAMP:
    case TYPE_TIMESTAMP2: {
      const raw = str();
      if (raw === null) return null;
      return parseMysqlInstant(raw);
    }
    case TYPE_DATETIME:
    case TYPE_DATETIME2:
    case TYPE_NEWDATE: {
      const raw = str();
      if (raw === null) return null;
      return parseMysqlPlainDateTime(raw);
    }
    case TYPE_DATE: {
      const raw = str();
      if (raw === null) return null;
      return parseMysqlDate(raw);
    }
    case TYPE_TIME:
    case TYPE_TIME2: {
      const raw = str();
      if (raw === null) return null;
      return parseMysqlTime(raw);
    }
    default:
      return next();
  }
}

/**
 * mysql2 pool options to wire up Temporal parsing.
 * Spread into the pool config AFTER user options so typeCast is never
 * overridden by a caller's config key.
 *
 * `dateStrings: true` is redundant when a custom typeCast is provided
 * (typeCast intercepts every field before mysql2's own Date parser runs),
 * but acts as a safety net if typeCast somehow doesn't handle a temporal
 * field — ensuring mysql2 falls back to a string rather than a Date object.
 */
export const TEMPORAL_POOL_OPTIONS: Pick<mysql.PoolOptions, "dateStrings" | "typeCast"> = {
  dateStrings: true,
  typeCast: temporalTypeCast as unknown as mysql.PoolOptions["typeCast"],
};
