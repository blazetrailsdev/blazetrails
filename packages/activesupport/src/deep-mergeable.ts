/**
 * DeepMergeable — mixin that provides deep_merge and deep_merge! methods.
 * Mirrors ActiveSupport::DeepMergeable.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepMergeObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  block?: (key: string, thisVal: unknown, otherVal: unknown) => unknown,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(a)) {
    const value = a[key];
    result[key] = isPlainObject(value) ? deepMergeObjects(value, {}) : value;
  }

  for (const key of Object.keys(b)) {
    const aVal = result[key];
    const bVal = b[key];

    if (isPlainObject(aVal) && isPlainObject(bVal)) {
      result[key] = deepMergeObjects(aVal, bVal, block);
    } else if (block && Object.hasOwn(a, key)) {
      result[key] = block(key, a[key], bVal);
    } else {
      result[key] = bVal;
    }
  }

  return result;
}

export namespace DeepMergeable {
  export function deepMerge(
    target: Record<string, unknown>,
    other: Record<string, unknown>,
    block?: (key: string, thisVal: unknown, otherVal: unknown) => unknown,
  ): Record<string, unknown> {
    return deepMergeObjects(target, other, block);
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
        deepMergeInPlace(thisVal, otherVal, block);
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
