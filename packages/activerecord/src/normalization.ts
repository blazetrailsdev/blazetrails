/**
 * Attribute normalization — wraps a cast type to apply normalizer functions.
 *
 * The class methods `normalizes`, `normalizeValueFor`, and instance method
 * `normalizeAttribute` are defined on ActiveModel::Model and inherited by
 * ActiveRecord::Base. This file provides the NormalizedValueType wrapper
 * that Rails defines in ActiveRecord::Normalization.
 *
 * Mirrors: ActiveRecord::Normalization
 */

import type { Base } from "./base.js";

/**
 * NormalizedValueType — decorates an underlying cast type with a normalizer.
 * When cast() is called, the value is first cast by the underlying type,
 * then the normalizer is applied.
 *
 * Mirrors: ActiveRecord::Normalization::NormalizedValueType
 */
export class NormalizedValueType {
  readonly castType: { cast(value: unknown): unknown; serialize?(value: unknown): unknown };
  readonly normalizer: (value: unknown) => unknown;
  readonly normalizeNil: boolean;

  constructor(options: {
    castType: { cast(value: unknown): unknown; serialize?(value: unknown): unknown };
    normalizer: (value: unknown) => unknown;
    normalizeNil?: boolean;
  }) {
    this.castType = options.castType;
    this.normalizer = options.normalizer;
    this.normalizeNil = options.normalizeNil ?? false;
  }

  cast(value: unknown): unknown {
    const castValue = this.castType.cast(value);
    return this._normalize(castValue);
  }

  serialize(value: unknown): unknown {
    const castValue = this.cast(value);
    return this.serializeCastValue(castValue);
  }

  serializeCastValue(value: unknown): unknown {
    if (typeof this.castType.serialize === "function") {
      return this.castType.serialize(value);
    }
    return value;
  }

  private _normalize(value: unknown): unknown {
    if (value === null || value === undefined) {
      if (!this.normalizeNil) return value;
    }
    return this.normalizer(value);
  }
}

/**
 * Declare normalizations for one or more attributes.
 * Delegates to the implementation on ActiveModel::Model.
 *
 * Mirrors: ActiveRecord::Normalization::ClassMethods#normalizes
 */
export function normalizes(
  this: typeof Base,
  ...args: [...string[], ((value: unknown) => unknown) | Record<string, unknown>]
): void {
  return (this as any).normalizes(...args);
}

/**
 * Normalize a value for a given attribute without a record instance.
 *
 * Mirrors: ActiveRecord::Normalization::ClassMethods#normalize_value_for
 */
export function normalizeValueFor(this: typeof Base, name: string, value: unknown): unknown {
  return (this as any).normalizeValueFor(name, value);
}

/**
 * Re-normalize an attribute in place on a record instance.
 *
 * Mirrors: ActiveRecord::Normalization#normalize_attribute
 */
export function normalizeAttribute(this: Base, name: string): void {
  return (this as any).normalizeAttribute(name);
}
