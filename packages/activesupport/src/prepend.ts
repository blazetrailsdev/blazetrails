/**
 * Ruby-style `prepend` — wraps methods on a target so the module's
 * version is called first and receives the original as `super_`.
 *
 * Ruby's `Module#prepend` inserts the module at the front of the
 * ancestor chain so `super` inside the module resolves to the original
 * method. TypeScript has no prototype-chain prepend; `prepend()` wraps
 * each target method in place. A call like `target.foo(...args)`
 * invokes `module.foo.call(this, originalFoo, ...args)`, letting the
 * module short-circuit or delegate via `originalFoo.call(this, ...)`.
 *
 * Mirrors: Ruby's `Module#prepend` — with the caveat that `super`
 * becomes an explicit first argument because TypeScript has no
 * language-level `super` equivalent for runtime-wrapped methods.
 *
 * Idempotency is the caller's responsibility — calling `prepend()` on
 * the same target+module twice will wrap twice, producing a chain.
 * For install-once semantics, guard with a flag as Rails does via
 * a railtie or `installed?` check.
 *
 * Usage:
 *   import { prepend } from "@blazetrails/activesupport";
 *
 *   prepend(Relation.prototype, {
 *     where(super_: Function, ...args: unknown[]) {
 *       return super_.call(this, ...processed(args));
 *     },
 *   });
 */
export type PrependMethod = (this: any, super_: Function, ...args: any[]) => unknown;

export interface PrependModule {
  readonly [methodName: string]: PrependMethod;
}

export function prepend<T extends object>(target: T, mod: PrependModule): void {
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    throw new TypeError("prepend: target must be an object or function");
  }

  for (const name of Object.keys(mod)) {
    const original = (target as Record<string, unknown>)[name];
    if (typeof original !== "function") {
      throw new Error(`prepend: cannot wrap ${name} — target has no method with that name`);
    }
    const wrapper = mod[name] as PrependMethod;
    (target as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
      return wrapper.call(this, original as Function, ...args);
    };
  }
}
