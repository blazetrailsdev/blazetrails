import { Type, ValueType } from "@blazetrails/activemodel";

export interface Coder {
  dump(value: unknown): string | null;
  load(value: unknown): unknown;
  objectClass?: new (...args: any[]) => any;
  assertValidValue?(value: unknown): void;
}

/**
 * A type that wraps another type with a serialization coder. Values are
 * serialized through the coder before being stored and deserialized when
 * loaded.
 *
 * Mirrors: ActiveRecord::Type::Serialized
 */
export class Serialized extends ValueType {
  readonly name = "serialized";
  readonly subtype: Type;
  readonly coder: Coder;

  private _defaultValue: unknown;
  private _defaultValueJson: string | undefined;

  constructor(subtype: Type, coder: Coder) {
    super();
    this.subtype = subtype;
    this.coder = coder;
    this._defaultValue = coder.load(null);
    if (typeof this._defaultValue === "object" && this._defaultValue !== null) {
      try {
        this._defaultValueJson = JSON.stringify(this._defaultValue);
      } catch {
        this._defaultValueJson = undefined;
      }
    }
  }

  accessor(): unknown {
    return null;
  }

  deserialize(value: unknown): unknown {
    if (this.isDefaultValue(value)) return value;
    const deserialized = this.subtype.deserialize?.(value) ?? value;
    return this.coder.load(deserialized);
  }

  cast(value: unknown): unknown {
    return this.deserialize(value);
  }

  serialize(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (this.isDefaultValue(value)) return null;
    const dumped = this.coder.dump(value);
    if (this.subtype.serialize) {
      return this.subtype.serialize(dumped);
    }
    return dumped;
  }

  override isChangedInPlace(rawOldValue: unknown, value: unknown): boolean {
    const oldSerialized = this.serialize(this.deserialize(rawOldValue));
    const newSerialized = this.serialize(value);
    return oldSerialized !== newSerialized;
  }

  assertValidValue(value: unknown): void {
    if (this.coder.assertValidValue) {
      this.coder.assertValidValue(value);
    }
  }

  override isForceEquality(value: unknown): boolean {
    return this.coder.objectClass !== undefined && value instanceof this.coder.objectClass;
  }

  override isSerialized(): boolean {
    return true;
  }

  private isDefaultValue(value: unknown): boolean {
    if (value === this._defaultValue) return true;
    if (value === null || value === undefined)
      return this._defaultValue === null || this._defaultValue === undefined;
    if (typeof value === "object" && this._defaultValueJson !== undefined) {
      try {
        return JSON.stringify(value) === this._defaultValueJson;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Returns the encoded (serialized) representation of a value, or undefined
 * if the value equals the default. Used for changed_in_place? detection.
 *
 * Mirrors: ActiveRecord::Type::Serialized#encoded (private)
 *
 * @internal
 */
export function encoded(serialized: Serialized, value: unknown): unknown {
  const defaultVal = serialized.coder.load(null);
  if (value === defaultVal) return undefined;
  if (
    typeof value === "object" &&
    value !== null &&
    typeof defaultVal === "object" &&
    defaultVal !== null
  ) {
    try {
      if (JSON.stringify(value) === JSON.stringify(defaultVal)) return undefined;
    } catch {
      // non-serializable; treat as non-default
    }
  }
  const payload = serialized.coder.dump(value);
  // Rails: if subtype.binary? wrap in Binary::Data. We return the payload directly
  // because TS has no Binary::Data equivalent; callers compare raw serialized strings.
  return payload;
}
