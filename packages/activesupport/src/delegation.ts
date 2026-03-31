/**
 * Delegation — delegate method calls to another object.
 * Mirrors ActiveSupport::Delegation and ActiveSupport::DelegationError.
 */

export class DelegationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelegationError";
  }

  static nilTarget(methodName: string, target: string): DelegationError {
    return new DelegationError(`${methodName} delegated to ${target}, but ${target} is nil`);
  }
}

export interface DelegateOptions {
  to: string;
  prefix?: boolean | string;
  allowNil?: boolean;
}

export namespace Delegation {
  export function generate<T extends object>(
    target: T,
    methods: string[],
    options: DelegateOptions,
  ): void {
    const { to, prefix, allowNil } = options;

    if (!to) {
      throw new Error(
        "Delegation needs a target. Supply a keyword argument 'to' (e.g. delegate('hello', { to: 'greeter' })).",
      );
    }

    const methodPrefix = prefix === true ? `${to}_` : prefix ? `${prefix}_` : "";

    for (const method of methods) {
      const methodName = `${methodPrefix}${method}`;

      Object.defineProperty(target, methodName, {
        configurable: true,
        enumerable: false,
        writable: true,
        value(...args: unknown[]) {
          const receiver = (this as Record<string, unknown>)[to];
          if (receiver == null) {
            if (allowNil) return undefined;
            throw DelegationError.nilTarget(methodName, to);
          }
          const fn = (receiver as Record<string, unknown>)[method];
          if (typeof fn !== "function") {
            throw new DelegationError(
              `${methodName} delegated to ${to}, but ${to}.${globalThis.String(method)} is not a function`,
            );
          }
          return fn.apply(receiver, args);
        },
      });
    }
  }

  export function generateMethodMissing<T extends object>(
    target: T,
    delegateTo: string,
    options: { allowNil?: boolean } = {},
  ): T {
    const boundCache = new Map<string | symbol, Function>();
    return new Proxy(target, {
      get(obj, prop, receiver) {
        if (prop in obj || typeof prop === "symbol") {
          return Reflect.get(obj, prop, receiver);
        }
        const delegate = (obj as Record<string, unknown>)[delegateTo];
        if (delegate == null) {
          if (options.allowNil) return undefined;
          throw DelegationError.nilTarget(globalThis.String(prop), delegateTo);
        }
        const val = (delegate as Record<string, unknown>)[globalThis.String(prop)];
        if (typeof val === "function") {
          const cached = boundCache.get(prop);
          if (cached) return cached;
          const bound = val.bind(delegate) as Function;
          boundCache.set(prop, bound);
          return bound;
        }
        return val;
      },
    });
  }
}
