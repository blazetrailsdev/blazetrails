/**
 * Mirrors: ActiveRecord::Middleware::DatabaseSelector::Resolver
 */

import { Notifications } from "@blazetrails/activesupport";
import { Temporal } from "@blazetrails/activesupport/temporal";
import { Session } from "./resolver/session.js";
import { Base } from "../../base.js";

export interface ResolverContext {
  lastWriteTimestamp(): Temporal.Instant;
  updateLastWriteTimestamp(): void;
  save(response: unknown): void;
}

const SEND_TO_REPLICA_DELAY = 2000;

export class Resolver {
  /** @internal */
  readonly context: ResolverContext;
  /** @internal */
  readonly delay: number;
  /** @internal */
  readonly instrumenter: typeof Notifications;

  constructor(context: ResolverContext, options: { delay?: number } = {}) {
    this.context = context;
    this.delay = options.delay !== undefined ? options.delay : SEND_TO_REPLICA_DELAY;
    this.instrumenter = Notifications;
  }

  static call(context: ResolverContext, options: { delay?: number } = {}): Resolver {
    return new Resolver(context, options);
  }

  async read<T>(blk: () => T | Promise<T>): Promise<T> {
    return this.isReadFromPrimaryQ() ? this.readFromPrimary(blk) : this.readFromReplica(blk);
  }

  async write<T>(blk: () => T | Promise<T>): Promise<T> {
    return this.writeToPrimary(blk);
  }

  updateContext(response: unknown): void {
    this.context.save(response);
  }

  isReadingRequest(request: { method: string }): boolean {
    const m = request.method.toUpperCase();
    return m === "GET" || m === "HEAD";
  }

  /** @internal */
  isReadPrimary(): boolean {
    return this.isReadFromPrimaryQ();
  }

  /** @internal */
  isReadReplica(): boolean {
    return !this.isReadFromPrimaryQ();
  }

  /** @internal */
  isPreventWritesToPrimary(): boolean {
    return false;
  }

  /** @internal */
  isRequiresPrimary(): boolean {
    return this.isReadFromPrimaryQ();
  }

  /** @internal */
  isSendRequestToPrimary(): boolean {
    return this.isReadFromPrimaryQ();
  }

  updateLastWriteTimestamp(): void {
    this.context.updateLastWriteTimestamp();
  }

  /** @internal */
  isPotentialWriteOperation(request: { method: string }): boolean {
    return !this.isReadingRequest(request);
  }

  /** @internal */
  isSavedRecentWrite(): boolean {
    return !this.isTimeSinceLastWriteOk();
  }

  /** @internal */
  isRecentWrite(time: Temporal.Instant): boolean {
    return Temporal.Now.instant().epochMilliseconds - time.epochMilliseconds < this.delay;
  }

  /** @internal */
  sendToReplicaDelay(): number {
    return this.delay;
  }

  /** @internal */
  secondsSinceLastWriteTimestamp(): number {
    return (
      (Temporal.Now.instant().epochMilliseconds -
        this.context.lastWriteTimestamp().epochMilliseconds) /
      1000
    );
  }

  /** @internal */
  contextFor(_request: unknown): ResolverContext {
    return this.context;
  }

  /** @internal */
  private isReadFromPrimaryQ(): boolean {
    return !this.isTimeSinceLastWriteOk();
  }

  private isTimeSinceLastWriteOk(): boolean {
    return (
      Temporal.Now.instant().epochMilliseconds -
        this.context.lastWriteTimestamp().epochMilliseconds >=
      this.delay
    );
  }

  private async readFromPrimary<T>(blk: () => T | Promise<T>): Promise<T> {
    return (Base as any).connectedTo({ role: "writing", preventWrites: true }, () =>
      Notifications.instrumentAsync("database_selector.active_record.read_from_primary", {}, () =>
        Promise.resolve(blk()),
      ),
    );
  }

  private async readFromReplica<T>(blk: () => T | Promise<T>): Promise<T> {
    return (Base as any).connectedTo({ role: "reading", preventWrites: true }, () =>
      Notifications.instrumentAsync("database_selector.active_record.read_from_replica", {}, () =>
        Promise.resolve(blk()),
      ),
    );
  }

  private async writeToPrimary<T>(blk: () => T | Promise<T>): Promise<T> {
    return (Base as any).connectedTo({ role: "writing", preventWrites: false }, () =>
      Notifications.instrumentAsync(
        "database_selector.active_record.wrote_to_primary",
        {},
        async () => {
          try {
            return await blk();
          } finally {
            this.context.updateLastWriteTimestamp();
          }
        },
      ),
    );
  }
}

export { Session };
