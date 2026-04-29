export abstract class Type<T = unknown> {
  abstract readonly name: string;
  readonly precision?: number;
  readonly limit?: number;
  protected readonly _scale?: number;

  constructor(options?: { precision?: number; scale?: number; limit?: number }) {
    if (options?.precision !== undefined) this.precision = options.precision;
    if (options?.scale !== undefined) this._scale = options.scale;
    if (options?.limit !== undefined) this.limit = options.limit;
  }

  /**
   * Rails defines `scale` as a method (`def scale; @scale; end`) so
   * subclasses like OID::Money can override with a constant value.
   * Expose it as a getter here so subclass `override get scale()` works.
   */
  get scale(): number | undefined {
    return this._scale;
  }

  abstract cast(value: unknown): T | null;

  type(): string {
    return this.name;
  }

  deserialize(value: unknown): T | null {
    return this.cast(value);
  }

  serialize(value: unknown): unknown {
    return value;
  }

  serializeCastValue(value: T | null): unknown {
    return value;
  }

  /**
   * Mirrors: ActiveModel::Type::SerializeCastValue#itself_if_serialize_cast_value_compatible
   * (serialize_cast_value.rb:36-38)
   *
   *   def itself_if_serialize_cast_value_compatible
   *     self if self.class.serialize_cast_value_compatible?
   *   end
   *
   * Returns `this` when the type's serialize path can short-circuit
   * through serialize_cast_value (i.e. the subclass has overridden
   * serialize_cast_value at the same level or above its `serialize`
   * override). Returns null otherwise. Used by SerializeCastValue.
   * serialize to skip a redundant cast on already-cast values.
   */
  itselfIfSerializeCastValueCompatible(): this | null {
    // Rails: ancestors.index(serialize_cast_value.owner) <= ancestors.index(serialize.owner).
    // A type is compatible when serialize_cast_value is defined at or
    // above serialize in the ancestor chain — i.e. a subclass that
    // overrides serialize MUST also override serialize_cast_value to
    // remain compatible. Walk the prototype chain to find each
    // method's defining ancestor.
    let proto: object | null = Object.getPrototypeOf(this);
    let serializeDepth = -1;
    let castDepth = -1;
    let depth = 0;
    while (proto && proto !== Object.prototype) {
      if (serializeDepth < 0 && Object.prototype.hasOwnProperty.call(proto, "serialize")) {
        serializeDepth = depth;
      }
      if (castDepth < 0 && Object.prototype.hasOwnProperty.call(proto, "serializeCastValue")) {
        castDepth = depth;
      }
      proto = Object.getPrototypeOf(proto);
      depth++;
    }
    return castDepth >= 0 && serializeDepth >= 0 && castDepth <= serializeDepth ? this : null;
  }

  isSerializable(_value: unknown): boolean {
    return true;
  }

  typeCastForSchema(value: unknown): string {
    return JSON.stringify(value) ?? String(value);
  }

  isBinary(): boolean {
    return false;
  }

  isChanged(oldValue: unknown, newValue: unknown, _newValueBeforeTypeCast?: unknown): boolean {
    return oldValue !== newValue;
  }

  isChangedInPlace(_rawOldValue: unknown, _newValue: unknown): boolean {
    return false;
  }

  isValueConstructedByMassAssignment(_value: unknown): boolean {
    return false;
  }

  isForceEquality(_value: unknown): boolean {
    return false;
  }

  map(value: T | null): T | null {
    return value;
  }

  assertValidValue(_value: unknown): void {}

  isSerialized(): boolean {
    return false;
  }

  isMutable(): boolean {
    return false;
  }

  asJson(): never {
    throw new Error("Unimplemented");
  }
}

export class ValueType<T = unknown> extends Type<T> {
  readonly name: string = "value";

  cast(value: unknown): T | null {
    // No-op default: pass the value through. Subclasses narrow by
    // overriding `cast` with a concrete return type.
    return value as T | null;
  }

  equals(other: Type): boolean {
    return this.constructor === other.constructor;
  }
}
