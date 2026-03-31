/**
 * Temporarily sets attributes on an object, executes a block, then restores
 * the original values. Mirrors Ruby's Object#with from ActiveSupport.
 */
export function objectWith<T extends Record<string, unknown>, R>(
  obj: T,
  attrs: Partial<T>,
  fn: (obj: T) => R,
): R {
  const saved: Partial<T> = {};
  const existed: Record<string, boolean> = {};
  const applied: string[] = [];

  try {
    for (const [key, value] of Object.entries(attrs)) {
      applied.push(key);
      const hadKey = Object.prototype.hasOwnProperty.call(obj, key);
      existed[key] = hadKey;
      if (hadKey) {
        saved[key as keyof T] = obj[key as keyof T];
      }
      obj[key as keyof T] = value as T[keyof T];
    }
    return fn(obj);
  } finally {
    for (const key of applied) {
      if (existed[key]) {
        obj[key as keyof T] = saved[key as keyof T] as T[keyof T];
      } else {
        delete (obj as Record<string, unknown>)[key];
      }
    }
  }
}
