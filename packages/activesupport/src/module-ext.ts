/**
 * Module extensions mirroring Rails ActiveSupport module/class extensions.
 * Covers delegate, mattr_accessor, cattr_accessor, attr_internal, and helpers.
 */

/**
 * delegate — creates methods on target that forward to another property.
 * Mirrors Rails Module#delegate.
 *
 * Usage:
 *   delegate(MyClass.prototype, "street", "city", { to: "place" });
 *   delegate(MyClass.prototype, "name", { to: "place", prefix: true });
 */
export function delegate(
  target: object,
  ...args: [...string[], { to: string; prefix?: boolean | string; allowNil?: boolean }]
): string[] {
  const options = args[args.length - 1] as {
    to: string;
    prefix?: boolean | string;
    allowNil?: boolean;
  };
  const methods = args.slice(0, -1) as string[];
  const { to, prefix, allowNil = false } = options;

  const generatedNames: string[] = [];

  for (const method of methods) {
    let methodName: string;
    if (prefix === true) {
      methodName = `${to}_${method}`;
    } else if (prefix && prefix !== false) {
      methodName = `${prefix}_${method}`;
    } else {
      methodName = method;
    }

    generatedNames.push(methodName);

    Object.defineProperty(target, methodName, {
      configurable: true,
      enumerable: false,
      get(this: Record<string, unknown>) {
        const delegatee = this[to];
        if (delegatee === null || delegatee === undefined) {
          if (allowNil) return undefined;
          throw new Error(
            `${methodName} delegated to ${to}, but ${to} is nil`
          );
        }
        return (delegatee as Record<string, unknown>)[method];
      },
      set(this: Record<string, unknown>, value: unknown) {
        const delegatee = this[to];
        if (delegatee === null || delegatee === undefined) {
          if (allowNil) return;
          throw new Error(
            `${methodName} delegated to ${to}, but ${to} is nil`
          );
        }
        (delegatee as Record<string, unknown>)[method] = value;
      },
    });
  }

  return generatedNames;
}

/**
 * delegateMissingTo — forwards any missing method calls to the named property.
 * Mirrors Rails Module#delegate_missing_to.
 */
export function delegateMissingTo(target: object, property: string): void {
  // In TypeScript/JS we implement this via a Proxy wrapper helper.
  // This attaches a marker; the proxy must be applied at construction time.
  (target as Record<string, unknown>).__delegateMissingTo__ = property;
}

/**
 * mattrAccessor — defines class-level attribute accessors (mattr_accessor).
 * Each name gets a static getter/setter backed by a hidden property.
 */
export function mattrAccessor(
  target: { new(...args: unknown[]): unknown } & Record<string, unknown>,
  ...names: string[]
): void {
  for (const name of names) {
    const storageKey = `__mattr_${name}__`;
    Object.defineProperty(target, name, {
      configurable: true,
      enumerable: false,
      get() {
        return (target as Record<string, unknown>)[storageKey];
      },
      set(value: unknown) {
        (target as Record<string, unknown>)[storageKey] = value;
      },
    });
  }
}

/**
 * cattrAccessor — alias for mattrAccessor (cattr_accessor in Rails).
 */
export const cattrAccessor = mattrAccessor;

/**
 * attrInternal — defines instance-level attribute with underscore-prefixed storage.
 * Mirrors Rails Module#attr_internal_accessor.
 */
export function attrInternal(target: object, ...names: string[]): void {
  for (const name of names) {
    const storageKey = `_${name}_`;
    Object.defineProperty(target, name, {
      configurable: true,
      enumerable: false,
      get(this: Record<string, unknown>) {
        return this[storageKey];
      },
      set(this: Record<string, unknown>, value: unknown) {
        this[storageKey] = value;
      },
    });

    Object.defineProperty(target, `${name}=`, {
      configurable: true,
      enumerable: false,
      value(this: Record<string, unknown>, value: unknown) {
        this[storageKey] = value;
      },
    });
  }
}

/**
 * isAnonymous — returns true if a class/function has no name.
 * Mirrors Ruby's Module#anonymous?.
 */
export function isAnonymous(klass: Function): boolean {
  return !klass.name || klass.name === "";
}

/**
 * moduleParentName — returns the parent namespace name of a class (best-effort in JS).
 * In Ruby this would parse the constant path. In JS/TS we can only go by convention.
 */
export function moduleParentName(klass: Function): string | null {
  const name = klass.name ?? "";
  const parts = name.split("::");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join("::");
}
