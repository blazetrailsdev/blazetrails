/**
 * Core time travel state used by both production code (TimeWithZone) and
 * testing helpers (travelTo, travelBack, etc.).
 *
 * Separated from testing-helpers so production code doesn't need to import
 * test assertion utilities.
 *
 * @boundary-file: `currentTime()` returns a JS `Date` because most consumers
 *   (legacy Rails-port code in `time-ext`, `duration`, etc.) are Date-typed.
 *   The clock source is `Temporal.Now.instant()`; the offset is stored in
 *   nanoseconds so sub-millisecond travel is preserved on the
 *   `currentTimeInstant()` path. Callers that want Temporal use
 *   `currentTimeInstant()` (or `Temporal.Now.instant()` directly).
 */

import { Temporal } from "./temporal.js";

let _frozenInstant: Temporal.Instant | null = null;
let _timeOffsetNs: bigint = 0n;

export function setFrozenTime(time: Date | null): void {
  _frozenInstant = time === null ? null : Temporal.Instant.fromEpochMilliseconds(time.getTime());
}

export function setTimeOffset(offsetMs: number): void {
  _timeOffsetNs = BigInt(Math.trunc(offsetMs)) * 1_000_000n;
}

/**
 * Returns the current time as a `Temporal.Instant`, respecting any active
 * time travel. Preserves nanosecond precision for both the frozen-time and
 * offset paths.
 */
export function currentTimeInstant(): Temporal.Instant {
  if (_frozenInstant) return _frozenInstant;
  if (_timeOffsetNs === 0n) return Temporal.Now.instant();
  return Temporal.Instant.fromEpochNanoseconds(
    Temporal.Now.instant().epochNanoseconds + _timeOffsetNs,
  );
}

/**
 * Returns the current time, respecting any active time travel.
 */
export function currentTime(): Date {
  return new Date(currentTimeInstant().epochMilliseconds);
}
