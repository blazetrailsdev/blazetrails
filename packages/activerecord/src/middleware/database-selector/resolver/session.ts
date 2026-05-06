/**
 * Mirrors: ActiveRecord::Middleware::DatabaseSelector::Resolver::Session
 */

import { Temporal } from "@blazetrails/activesupport/temporal";

export interface SessionStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export class Session {
  /** @internal */
  readonly session: SessionStore;

  constructor(session: SessionStore) {
    this.session = session;
  }

  static call(request: { session: SessionStore }): Session {
    return new Session(request.session);
  }

  static convertTimeToTimestamp(time: Temporal.Instant): number {
    return time.epochMilliseconds;
  }

  static convertTimestampToTime(timestamp: number | undefined): Temporal.Instant {
    return Temporal.Instant.fromEpochMilliseconds(timestamp ?? 0);
  }

  lastWriteTimestamp(): Temporal.Instant {
    const raw = this.session.get("lastWrite");
    // Non-numeric/NaN session value → epoch 0 → treated as "very long ago" → route to primary.
    return Session.convertTimestampToTime(Number.isFinite(raw) ? (raw as number) : undefined);
  }

  updateLastWriteTimestamp(): void {
    this.session.set("lastWrite", Session.convertTimeToTimestamp(Temporal.Now.instant()));
  }

  save(_response: unknown): void {}
}
