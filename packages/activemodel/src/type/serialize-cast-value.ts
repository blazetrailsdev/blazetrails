/**
 * SerializeCastValue — optimization for skipping redundant casts during serialization.
 *
 * Mirrors: ActiveModel::Type::SerializeCastValue
 *
 * In Rails, when a type's serialize method just calls cast then
 * serializes, SerializeCastValue lets the system skip the cast step
 * if the value is already cast. This avoids double-casting on save.
 */

export interface SerializeCastValue {
  itselfIfSerializeCastValueCompatible(): unknown;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SerializeCastValue {
  /**
   * Mirrors: ActiveModel::Type::SerializeCastValue::ClassMethods
   *
   * Provides serialize_cast_value_compatible? which checks if a type
   * has overridden serialize_cast_value.
   */
  export interface ClassMethods {
    serializeCastValueCompatible(): boolean;
  }

  export interface DefaultImplementation {
    serializeCastValue(value: unknown): unknown;
  }

  export function serializeCastValue(value: unknown): unknown {
    return value;
  }
}

/**
 * Mixin hook — includes DefaultImplementation if not already defined.
 *
 * Mirrors: ActiveModel::Type::SerializeCastValue.included(klass)
 *
 * In Rails, when a type class includes SerializeCastValue, this hook
 * adds a default serialize_cast_value(value) { value } method if the
 * class hasn't defined one yet, and adds the class-level
 * serialize_cast_value_compatible? check.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function included(klass: any): void {
  if (typeof klass.prototype.serializeCastValue !== "function") {
    klass.prototype.serializeCastValue = function (value: unknown): unknown {
      return value;
    };
  }

  if (typeof klass.serializeCastValueCompatible !== "function") {
    klass.serializeCastValueCompatible = function (): boolean {
      return typeof this.prototype?.serializeCastValue === "function";
    };
  }
}

export function itselfIfSerializeCastValueCompatible(type: {
  serialize(value: unknown): unknown;
  serializeCastValue?(value: unknown): unknown;
}): typeof type | null {
  if (typeof type.serializeCastValue === "function") {
    return type;
  }
  return null;
}

export function serializeCastValueCompatible(typeCtor: {
  prototype: { serializeCastValue?(value: unknown): unknown };
}): boolean {
  return typeof typeCtor.prototype.serializeCastValue === "function";
}
