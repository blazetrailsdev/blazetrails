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
  const applied: string[] = [];

  try {
    for (const [key, value] of Object.entries(attrs)) {
      saved[key as keyof T] = obj[key as keyof T];
      obj[key as keyof T] = value as T[keyof T];
      applied.push(key);
    }
    return fn(obj);
  } finally {
    for (const key of applied) {
      obj[key as keyof T] = saved[key as keyof T] as T[keyof T];
    }
  }
}
