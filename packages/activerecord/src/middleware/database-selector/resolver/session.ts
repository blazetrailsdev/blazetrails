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
    return Session.convertTimestampToTime(this.session.get("lastWrite") as number | undefined);
  }

  updateLastWriteTimestamp(): void {
    this.session.set("lastWrite", Session.convertTimeToTimestamp(Temporal.Now.instant()));
  }

  save(_response: unknown): void {}

  /** @internal */
  restoreSession(request: { session: SessionStore }): void {
    this.session.set("lastWrite", request.session.get("lastWrite"));
  }

  /** @internal */
  contextFor(request: { session: SessionStore }): Session {
    return new Session(request.session);
  }

  /** @internal */
  delete(key: string): void {
    this.session.delete(key);
  }

  /** @internal */
  isStale(delaySeconds: number): boolean {
    const elapsed =
      Temporal.Now.instant().epochMilliseconds - this.lastWriteTimestamp().epochMilliseconds;
    return elapsed >= delaySeconds * 1000;
  }
}
