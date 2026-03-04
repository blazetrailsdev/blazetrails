/**
 * Serialization options.
 */
export interface SerializeOptions {
  only?: string[];
  except?: string[];
  methods?: string[];
}

/**
 * Serialize a model's attributes to a plain object.
 *
 * Mirrors: ActiveModel::Serialization#serializable_hash
 */
export function serializableHash(
  record: any,
  options: SerializeOptions = {}
): Record<string, unknown> {
  const attrs: Map<string, unknown> = record._attributes ?? new Map();
  let keys = Array.from(attrs.keys());

  if (options.only) {
    keys = keys.filter((k) => options.only!.includes(k));
  } else if (options.except) {
    keys = keys.filter((k) => !options.except!.includes(k));
  }

  const result: Record<string, unknown> = {};
  for (const key of keys) {
    result[key] = attrs.get(key);
  }

  if (options.methods) {
    for (const method of options.methods) {
      if (typeof record[method] === "function") {
        result[method] = record[method]();
      } else if (method in record) {
        result[method] = record[method];
      }
    }
  }

  return result;
}
