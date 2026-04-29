import { Temporal } from "@js-temporal/polyfill";

export { Temporal };

/** Bridge a JS Date to a Temporal.Instant (truncated to integer milliseconds). */
export function instantFrom(date: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}
