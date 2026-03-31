export type EventPayload = Record<string, unknown>;

let _txCounter = 0;
function generateTransactionId(): string {
  return `tx-${Date.now()}-${(++_txCounter).toString(36)}`;
}

/**
 * Mirrors ActiveSupport::Notifications::Event.
 */
export class Event {
  readonly name: string;
  readonly time: Date;
  end: Date | null;
  readonly payload: EventPayload;
  readonly transactionId: string;
  readonly children: Event[];

  constructor(name: string, start: Date, payload: EventPayload = {}, transactionId?: string) {
    this.name = name;
    this.time = start;
    this.end = null;
    this.payload = payload;
    this.transactionId = transactionId ?? generateTransactionId();
    this.children = [];
  }

  /** Duration in milliseconds (like Rails' Event#duration in ms). */
  get duration(): number {
    if (!this.end) return 0;
    return this.end.getTime() - this.time.getTime();
  }

  /** Alias: Rails calls it `duration` but measured in ms. */
  durationMs(): number {
    return this.duration;
  }

  finish(endTime?: Date): void {
    this.end = endTime ?? new Date();
  }
}

export class Instrumenter {
  private _notifier: { publish(name: string, event: Event): void };
  private _stack: Event[] = [];
  readonly id: string;

  constructor(notifier: { publish(name: string, event: Event): void }) {
    this._notifier = notifier;
    this.id = generateTransactionId();
  }

  instrument<T = void>(name: string, payload: EventPayload = {}, fn?: (event: Event) => T): T {
    const event = new Event(name, new Date(), payload, this.id);
    const parent = this._stack[this._stack.length - 1];
    if (parent) parent.children.push(event);
    this._stack.push(event);

    const cleanup = () => {
      event.finish();
      this._notifier.publish(name, event);
      this._stack.pop();
    };

    if (!fn) {
      cleanup();
      return undefined as unknown as T;
    }

    let result: T;
    try {
      result = fn(event);
    } catch (error) {
      cleanup();
      throw error;
    }

    if (result && typeof (result as unknown as { then?: unknown }).then === "function") {
      return (result as unknown as Promise<unknown>).finally(cleanup) as unknown as T;
    }

    cleanup();
    return result;
  }

  async instrumentAsync<T = void>(
    name: string,
    payload: EventPayload = {},
    fn?: (event: Event) => Promise<T>,
  ): Promise<T> {
    const event = new Event(name, new Date(), payload, this.id);
    const parent = this._stack[this._stack.length - 1];
    if (parent) parent.children.push(event);
    this._stack.push(event);

    try {
      if (fn) return await fn(event);
      return undefined as unknown as T;
    } finally {
      event.finish();
      this._notifier.publish(name, event);
      this._stack.pop();
    }
  }
}

export class LegacyHandle {
  private _event: Event;
  private _notifier: { publish(name: string, event: Event): void };

  constructor(event: Event, notifier: { publish(name: string, event: Event): void }) {
    this._event = event;
    this._notifier = notifier;
  }

  finish(): void {
    this._event.finish();
    this._notifier.publish(this._event.name, this._event);
  }
}

export class Wrapper {
  private _instrumenter: Instrumenter;

  constructor(notifier: { publish(name: string, event: Event): void }) {
    this._instrumenter = new Instrumenter(notifier);
  }

  get instrumenter(): Instrumenter {
    return this._instrumenter;
  }
}
