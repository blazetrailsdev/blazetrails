/**
 * DeepMergeable — mixin that provides deep_merge and deep_merge! methods.
 * Mirrors ActiveSupport::DeepMergeable.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export namespace DeepMergeable {
  export function deepMerge(
    target: Record<string, unknown>,
    other: Record<string, unknown>,
    block?: (key: string, thisVal: unknown, otherVal: unknown) => unknown,
  ): Record<string, unknown> {
    const result = { ...target };
    return deepMergeInPlace(result, other, block);
  }

  export function deepMergeInPlace(
    target: Record<string, unknown>,
    other: Record<string, unknown>,
    block?: (key: string, thisVal: unknown, otherVal: unknown) => unknown,
  ): Record<string, unknown> {
    for (const key of Object.keys(other)) {
      const thisVal = target[key];
      const otherVal = other[key];

      if (isPlainObject(thisVal) && isPlainObject(otherVal)) {
        target[key] = deepMerge(thisVal, otherVal, block);
      } else if (block && Object.hasOwn(target, key)) {
        target[key] = block(key, thisVal, otherVal);
      } else {
        target[key] = otherVal;
      }
    }
    return target;
  }

  export function isDeepMergeable(other: unknown): boolean {
    return isPlainObject(other);
  }
}
