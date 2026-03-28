type AnyObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is AnyObject {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export class DeepMergeable {
  static deepMerge<T extends AnyObject>(target: T, source: AnyObject): T {
    const result = { ...target } as AnyObject;
    for (const key of Object.keys(source)) {
      const targetVal = result[key];
      const sourceVal = source[key];
      if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
        result[key] = DeepMergeable.deepMerge(targetVal as AnyObject, sourceVal as AnyObject);
      } else {
        result[key] = sourceVal;
      }
    }
    return result as T;
  }

  static deepMergeInPlace<T extends AnyObject>(target: T, source: AnyObject): T {
    for (const key of Object.keys(source)) {
      const targetVal = target[key as keyof T];
      const sourceVal = source[key];
      if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
        DeepMergeable.deepMergeInPlace(targetVal as AnyObject, sourceVal as AnyObject);
      } else {
        (target as AnyObject)[key] = sourceVal;
      }
    }
    return target;
  }
}
