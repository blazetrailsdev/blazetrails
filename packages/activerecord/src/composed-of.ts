import type { Base } from "./base.js";
import { AggregateReflection } from "./reflection.js";
import { getAggregationCache } from "./aggregations.js";

interface ComposedOfOptions {
  className: new (...args: any[]) => any;
  mapping: [string, string][];
  constructorFn?: (...args: any[]) => any;
  converter?: (value: unknown) => unknown;
}

/**
 * Configure a composed-of value object on a model.
 *
 * Mirrors: ActiveRecord::Aggregations.composed_of
 *
 * Usage:
 *   composedOf(Customer, 'address', {
 *     className: Address,
 *     mapping: [['address_street', 'street'], ['address_city', 'city']],
 *   })
 *
 * This adds:
 *   - customer.address → Address instance composed from mapped attributes
 *   - customer.address = new Address(...) → decomposes into mapped attributes
 */
export function composedOf(
  modelClass: typeof Base,
  name: string,
  options: ComposedOfOptions,
): void {
  // Store aggregate reflection for reflect_on_all_aggregations
  if (!Object.prototype.hasOwnProperty.call(modelClass, "_aggregateReflections")) {
    const parent: Map<string, AggregateReflection> | undefined = (modelClass as any)
      ._aggregateReflections;
    (modelClass as any)._aggregateReflections = parent ? new Map(parent) : new Map();
  }
  (modelClass as any)._aggregateReflections.set(
    name,
    new AggregateReflection(
      name,
      null,
      {
        className: options.className.name,
        mapping: options.mapping,
        anonymousClass: options.className,
      },
      modelClass,
    ),
  );

  // Getter: read from aggregation cache or build and cache the value object.
  // Mirrors: Rails' reader_method — caches in @aggregation_cache[name].freeze
  Object.defineProperty(modelClass.prototype, name, {
    get(this: Base): unknown {
      const cache = getAggregationCache(this);
      if (cache.has(name)) return cache.get(name);

      const args = options.mapping.map(([modelAttr]) => this.readAttribute(modelAttr));
      if (args.every((a) => a === null || a === undefined)) return null;

      const obj = new options.className(...args);
      // Rails freezes the cached object; we store it as-is (freeze is opt-in in JS)
      cache.set(name, obj);
      return obj;
    },
    set(this: Base, value: unknown): void {
      const cache = getAggregationCache(this);

      if (value === null || value === undefined) {
        for (const [modelAttr] of options.mapping) {
          this.writeAttribute(modelAttr, null);
        }
        // Don't cache null — let the reader recompute (mirrors Rails where
        // nil cache entry triggers a rebuild attempt on next read).
        cache.delete(name);
        return;
      }

      // If it's an instance of the class, decompose it and cache
      if (value instanceof options.className) {
        for (const [modelAttr, valueAttr] of options.mapping) {
          this.writeAttribute(modelAttr, (value as any)[valueAttr]);
        }
        cache.set(name, value);
        return;
      }

      // Try converter
      if (options.converter) {
        const converted = options.converter(value);
        if (converted instanceof options.className) {
          for (const [modelAttr, valueAttr] of options.mapping) {
            this.writeAttribute(modelAttr, (converted as any)[valueAttr]);
          }
          cache.set(name, converted);
        }
      }
    },
    configurable: true,
  });
}
