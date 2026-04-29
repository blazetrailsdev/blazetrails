import { Node } from "../nodes/node.js";

/**
 * Thrown when no visit method is registered for a node's runtime class
 * (after walking the prototype chain).
 *
 * Mirrors the `TypeError` Rails raises in `Arel::Visitors::Visitor#visit`.
 */
export class UnsupportedVisitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedVisitError";
  }
}

export type NodeCtor = abstract new (...args: never[]) => Node;
type VisitorCtor = typeof Visitor;

const PER_CLASS_CACHE = new WeakMap<VisitorCtor, Map<NodeCtor, string>>();

/**
 * Base visitor with class-tagged dispatch.
 *
 * Mirrors: Arel::Visitors::Visitor (activerecord/lib/arel/visitors/visitor.rb).
 *
 * Ruby uses `__send__("visit_#{klass.name.gsub('::','_')}")` keyed by the
 * runtime class. We can't use string-named methods cleanly in TS without
 * losing typecheck, so we keep camelCase method names and route through an
 * explicit dispatch table: each `Visitor` subclass populates its own
 * `dispatchCache` (a `Map<NodeCtor, methodName>`), and `visit` looks up the
 * runtime constructor, falling back to the prototype chain (mirroring
 * Ruby's `klass.ancestors` walk).
 */
export abstract class Visitor {
  protected dispatch: Map<NodeCtor, string>;

  constructor() {
    this.dispatch = (this.constructor as VisitorCtor).getDispatchCache();
  }

  accept(object: Node, collector?: unknown): unknown {
    return this.visit(object, collector);
  }

  /**
   * Per-class dispatch cache. Each subclass gets its own map seeded from
   * its parent (mirrors Rails' `@dispatch_cache ||= ...` per-class ivar).
   */
  static dispatchCache(this: VisitorCtor): Map<NodeCtor, string> {
    let cache = PER_CLASS_CACHE.get(this);
    if (!cache) {
      const parent = Object.getPrototypeOf(this) as VisitorCtor | null;
      const inherited =
        parent && typeof parent.dispatchCache === "function" && parent !== this
          ? parent.dispatchCache()
          : undefined;
      cache = new Map(inherited);
      PER_CLASS_CACHE.set(this, cache);
    }
    return cache;
  }

  static getDispatchCache(this: VisitorCtor): Map<NodeCtor, string> {
    return this.dispatchCache();
  }

  protected visit(object: Node, collector?: unknown): unknown {
    const ctor = object.constructor as NodeCtor;
    const methodName = this.resolveDispatch(ctor);
    const fn = methodName ? (this as unknown as Record<string, unknown>)[methodName] : undefined;
    if (typeof fn !== "function") {
      throw new UnsupportedVisitError(`Unknown node type: ${ctor.name}`);
    }
    return (fn as (n: Node, c?: unknown) => unknown).call(this, object, collector);
  }

  /**
   * Resolve the dispatch method name for `ctor`, walking the JS prototype
   * chain to find an ancestor's handler when there is no direct entry.
   * Mirrors Ruby's `klass.ancestors.find { |k| respond_to?(dispatch[k]) }`.
   * Successful lookups are memoized into the cache, matching Rails.
   */
  private resolveDispatch(ctor: NodeCtor): string | undefined {
    const direct = this.dispatch.get(ctor);
    if (direct) return direct;
    let cur: NodeCtor | null = ctor;
    while (cur) {
      const proto = Object.getPrototypeOf(cur.prototype) as object | null;
      const parent = proto?.constructor as NodeCtor | undefined;
      if (!parent || (parent as unknown) === Object) return undefined;
      const found = this.dispatch.get(parent);
      if (found) {
        this.dispatch.set(ctor, found);
        return found;
      }
      cur = parent;
    }
    return undefined;
  }
}
