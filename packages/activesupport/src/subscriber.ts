import { Notifications } from "./notifications.js";
import type { NotificationSubscriber } from "./notifications.js";
import type { Event } from "./notifications/instrumenter.js";

function snakeCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function camelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * ActiveSupport::Subscriber — base class for notification consumers.
 *
 * Subclasses define instance methods matching event prefixes (e.g. `sql`
 * for `sql.active_record`). Calling `attach_to(:active_record)` wires
 * up subscriptions automatically.
 */
export class Subscriber {
  /** Per-instance map of pattern → Notifications subscriber handle. */
  patterns: Map<string, NotificationSubscriber> = new Map();

  // -- Class-level state (static) ------------------------------------------

  private static _subscribers: Subscriber[] = [];
  private static _namespace: string | undefined;
  private static _subscriber: Subscriber | undefined;
  private static _notifier: typeof Notifications | undefined;

  static get subscribers(): Subscriber[] {
    return this._subscribers;
  }

  /**
   * Attach a subscriber instance to a namespace.
   * Every public method on the subscriber (minus Subscriber's own methods)
   * becomes a listener for `<method>.<namespace>` events.
   */
  static attachTo(
    namespace: string,
    subscriber?: Subscriber,
    notifier: typeof Notifications = Notifications,
    options?: { inheritAll?: boolean },
  ): Subscriber {
    const sub = subscriber ?? new (this as any)();
    this._namespace = namespace;
    this._subscriber = sub;
    this._notifier = notifier;

    this._subscribers.push(sub);

    const methods = this._fetchPublicMethods(sub, options?.inheritAll ?? false);
    for (const event of methods) {
      this._addEventSubscriber(event);
    }

    return sub;
  }

  /** Detach a subscriber from its namespace. */
  static detachFrom(namespace: string, notifier: typeof Notifications = Notifications): void {
    this._namespace = namespace;
    this._notifier = notifier;
    const sub = this._subscribers.find((s) => s instanceof this);
    if (!sub) return;

    this._subscriber = sub;
    const idx = this._subscribers.indexOf(sub);
    if (idx !== -1) this._subscribers.splice(idx, 1);

    const methods = this._fetchPublicMethods(sub, true);
    for (const event of methods) {
      this._removeEventSubscriber(event);
    }
    this._notifier = undefined;
  }

  // -- Instance methods ----------------------------------------------------

  call(event: Event): void {
    const dotIdx = event.name.indexOf(".");
    if (dotIdx === -1) return;
    const snakeMethod = event.name.slice(0, dotIdx);
    const camelMethod = camelCase(snakeMethod);
    const method =
      typeof (this as any)[camelMethod] === "function"
        ? camelMethod
        : typeof (this as any)[snakeMethod] === "function"
          ? snakeMethod
          : null;
    if (method) (this as any)[method](event);
  }

  publishEvent(event: Event): void {
    const dotIdx = event.name.indexOf(".");
    if (dotIdx === -1) return;
    const snakeMethod = event.name.slice(0, dotIdx);
    const camelMethod = camelCase(snakeMethod);
    const method =
      typeof (this as any)[camelMethod] === "function"
        ? camelMethod
        : typeof (this as any)[snakeMethod] === "function"
          ? snakeMethod
          : null;
    if (method) (this as any)[method](event);
  }

  // -- Private class helpers -----------------------------------------------

  private static _invalidEvent(event: string): boolean {
    return event === "start" || event === "finish";
  }

  private static _preparePattern(event: string): string {
    return `${event}.${this._namespace}`;
  }

  private static _addEventSubscriber(event: string): void {
    if (this._invalidEvent(event)) return;
    const sub = this._subscriber!;
    const notifier = this._notifier!;
    const pattern = this._preparePattern(event);

    if (sub.patterns.has(pattern)) return;

    const handle = notifier.subscribe(pattern, (e) => sub.call(e));
    sub.patterns.set(pattern, handle);
  }

  private static _removeEventSubscriber(event: string): void {
    if (this._invalidEvent(event)) return;
    const sub = this._subscriber!;
    const notifier = this._notifier!;
    const pattern = this._preparePattern(event);

    const handle = sub.patterns.get(pattern);
    if (!handle) return;

    notifier.unsubscribe(handle);
    sub.patterns.delete(pattern);
  }

  protected static _fetchPublicMethods(subscriber: Subscriber, _inheritAll: boolean): string[] {
    const baseKeys = new Set(Object.getOwnPropertyNames(Subscriber.prototype));
    const proto = Object.getPrototypeOf(subscriber);
    const keys = Object.getOwnPropertyNames(proto).filter(
      (k) =>
        k !== "constructor" && !baseKeys.has(k) && typeof (subscriber as any)[k] === "function",
    );
    // Convert camelCase method names to snake_case event names for patterns
    return keys.map((k) => snakeCase(k));
  }
}
