import { Node } from "../nodes/node.js";

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
type NodeCtor = abstract new (...args: never[]) => Node;
type VisitorCtor = typeof Visitor;

const PER_CLASS_CACHE = new WeakMap<VisitorCtor, Map<NodeCtor, string>>();

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
    let methodName = this.dispatch.get(ctor);
    if (!methodName) {
      let cur: NodeCtor | null = ctor;
      while (cur) {
        const proto = Object.getPrototypeOf(cur.prototype) as object | null;
        const parent = proto?.constructor as NodeCtor | undefined;
        if (!parent || (parent as unknown) === Object) break;
        const found = this.dispatch.get(parent);
        if (found) {
          methodName = found;
          this.dispatch.set(ctor, found);
          break;
        }
        cur = parent;
      }
    }
    const fn = methodName ? (this as unknown as Record<string, unknown>)[methodName] : undefined;
    if (typeof fn !== "function") {
      throw new TypeError(`Cannot visit ${ctor.name}`);
    }
    return (fn as (n: Node, c?: unknown) => unknown).call(this, object, collector);
  }
}
