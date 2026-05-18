/**
 * ActionController::RateLimiting
 *
 * Applies a rate limit to controller actions, refusing requests that
 * exceed the limit with 429 Too Many Requests.
 * @see https://api.rubyonrails.org/classes/ActionController/RateLimiting.html
 */

import { Notifications } from "@blazetrails/activesupport";
import type { CallbackOptions } from "../../abstract-controller/callbacks.js";

/** Options accepted by the `rateLimit` class DSL. */
export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. */
  to: number;
  /** Window length in seconds (Rails uses `ActiveSupport::Duration`). */
  within: number;
  /**
   * Per-request identity function. Default is the remote IP. Invoked with
   * the controller as `this`, matching Rails' `instance_exec(&by)`.
   */
  by?: (this: RateLimitingHost) => string | null | undefined;
  /**
   * Action to take when the limit is exceeded. Invoked with the controller
   * as `this`. Defaults to `head(429)`.
   */
  with?: (this: RateLimitingHost) => void | Promise<void>;
  /** Cache backend used to count requests. Defaults to the host's cacheStore. */
  store?: RateLimitStore;
  /** Distinct name when multiple rate limits are stacked on one controller. */
  name?: string;
  /** Standard before_action `only:` filter. */
  only?: string | string[];
  /** Standard before_action `except:` filter. */
  except?: string | string[];
  /** Standard before_action `if:` filter. */
  if?: CallbackOptions["if"];
  /** Standard before_action `unless:` filter. */
  unless?: CallbackOptions["unless"];
  /** Prepend the before_action (Rails `prepend: true`). */
  prepend?: boolean;
}

/**
 * Minimal cache-backend contract used by `rateLimiting`.
 *
 * Mirrors `ActiveSupport::Cache::Store#increment(key, amount, expires_in:)`
 * but typed in camelCase. Implementations may be sync or async; the helper
 * awaits the return value.
 */
export interface RateLimitStore {
  increment(
    key: string,
    amount: number,
    options: { expiresIn: number },
  ): number | null | Promise<number | null>;
}

/**
 * In-memory `RateLimitStore` for tests and single-process apps.
 *
 * Expiry is checked lazily on each `increment` for the touched key, matching
 * `activesupport/cache/memory-store` (memory-store.ts:135). To prevent
 * unbounded growth from one-off identities, the store also sweeps expired
 * entries once the map crosses `_PRUNE_BASELINE` (1024). If the sweep frees
 * space, the threshold resets to the baseline — so subsequent low-volume
 * workloads don't carry stale entries past the next baseline. Only when a
 * sweep fails to free space (every entry still live) does the threshold
 * double, amortizing the O(N) walk against the next burst.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private static readonly _PRUNE_BASELINE = 1024;
  private _entries = new Map<string, { count: number; expiresAt: number }>();
  private _pruneThreshold = MemoryRateLimitStore._PRUNE_BASELINE;

  increment(key: string, amount: number, options: { expiresIn: number }): number {
    const now = Date.now();
    const entry = this._entries.get(key);
    if (entry && entry.expiresAt > now) {
      entry.count += amount;
      return entry.count;
    }
    this._entries.set(key, { count: amount, expiresAt: now + options.expiresIn * 1000 });
    if (this._entries.size >= this._pruneThreshold) this._pruneExpired(now);
    return amount;
  }

  private _pruneExpired(now: number): void {
    const before = this._entries.size;
    for (const [key, entry] of this._entries) {
      if (entry.expiresAt <= now) this._entries.delete(key);
    }
    if (this._entries.size < before) {
      this._pruneThreshold = Math.max(MemoryRateLimitStore._PRUNE_BASELINE, this._entries.size * 2);
    } else {
      this._pruneThreshold *= 2;
    }
  }
}

/** Returns true when `count` exceeds `limit`. */
export function isRateLimited(count: number, limit: number): boolean {
  return count > limit;
}

/**
 * Host contract for the class DSL: the controller class must expose
 * `beforeAction` and a default `cacheStore`. Matches the subset of
 * `AbstractController` + `ActionController::Base` that Rails' DSL touches.
 */
// `beforeAction` is intentionally untyped on this contract: AbstractController
// types its callback against AbstractController, but the DSL only needs the
// method to exist on the host class. Concrete subclasses (Base/Metal) supply
// the stricter type at the call site.
export interface RateLimitingClassHost {
  beforeAction: Function; // eslint-disable-line @typescript-eslint/no-unsafe-function-type
  /**
   * Mirrors the existing `cacheStore?: ... | null` convention on
   * AbstractController caching/fragments (caching.ts:35, fragments.ts:24).
   */
  cacheStore?: RateLimitStore | null;
}

/**
 * Host contract for the instance helper: each request needs an identifying
 * string (Rails uses `request.remote_ip`) and a sink for over-limit responses.
 */
export interface RateLimitingHost {
  /**
   * Rails delegates `controller_path` to the class; Metal exposes it as an
   * instance method. Accept either a method or a string property so the
   * helper composes the right cache key under both shapes.
   */
  controllerPath?: string | (() => string);
  request?: { remoteIp?: string | null };
  head?: (status: number) => void;
}

/**
 * Class DSL: register a rate limit on all actions (or `only:`/`except:`).
 *
 * Mirrors Rails `ActionController::RateLimiting::ClassMethods#rate_limit`
 * (actionpack/lib/action_controller/metal/rate_limiting.rb, lines 55–57):
 *
 *     def rate_limit(to:, within:, by: -> { request.remote_ip },
 *                    with: -> { head :too_many_requests },
 *                    store: cache_store, name: nil, **options)
 *       before_action -> {
 *         rate_limiting(to:, within:, by:, with:, store:, name:)
 *       }, **options
 *     end
 */
export function rateLimit(this: RateLimitingClassHost, options: RateLimitOptions): void {
  const {
    to,
    within,
    by,
    with: withCallback,
    store,
    name,
    only,
    except,
    if: ifFilter,
    unless: unlessFilter,
    prepend,
  } = options;
  const resolvedStore = store ?? this.cacheStore;
  if (!resolvedStore) {
    throw new Error(
      "rateLimit requires a `store:` option or a `cacheStore` on the controller class.",
    );
  }
  const filter: CallbackOptions = {};
  if (only !== undefined) filter.only = Array.isArray(only) ? only : [only];
  if (except !== undefined) filter.except = Array.isArray(except) ? except : [except];
  if (ifFilter !== undefined) filter.if = ifFilter;
  if (unlessFilter !== undefined) filter.unless = unlessFilter;
  if (prepend !== undefined) filter.prepend = prepend;

  const callback = async (controller: RateLimitingHost): Promise<void> => {
    await rateLimiting.call(controller, {
      to,
      within,
      by,
      with: withCallback,
      store: resolvedStore,
      name,
    });
  };
  (this.beforeAction as (cb: typeof callback, opts?: CallbackOptions) => void)(callback, filter);
}

/**
 * Private instance helper invoked by the registered `beforeAction`.
 *
 * Mirrors Rails `ActionController::RateLimiting#rate_limiting`
 * (actionpack/lib/action_controller/metal/rate_limiting.rb, lines 61–69).
 *
 * @internal
 */
export async function rateLimiting(
  this: RateLimitingHost,
  args: {
    to: number;
    within: number;
    by?: (this: RateLimitingHost) => string | null | undefined;
    with?: (this: RateLimitingHost) => void | Promise<void>;
    store: RateLimitStore;
    name?: string;
  },
): Promise<void> {
  const identity = args.by ? args.by.call(this) : (this.request?.remoteIp ?? null);
  const controllerPath =
    typeof this.controllerPath === "function" ? this.controllerPath() : this.controllerPath;
  const cacheKey = ["rate-limit", controllerPath, args.name, identity]
    .filter((part): part is string => part != null)
    .join(":");
  const count = await args.store.increment(cacheKey, 1, { expiresIn: args.within });
  if (count != null && isRateLimited(count, args.to)) {
    await Notifications.instrumentAsync(
      "rate_limit.action_controller",
      { request: this.request },
      async () => {
        if (args.with) {
          await args.with.call(this);
        } else if (this.head) {
          this.head(429);
        }
      },
    );
  }
}
