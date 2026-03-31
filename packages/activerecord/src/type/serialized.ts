import { Type } from "@blazetrails/activemodel";

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
export class Serialized extends Type {
  readonly name = "serialized";
  readonly subtype: Type;
  readonly coder: Coder;

  private _defaultValue: unknown;

  constructor(subtype: Type, coder: Coder) {
    super();
    this.subtype = subtype;
    this.coder = coder;
    this._defaultValue = coder.load(null);
  }

  deserialize(value: unknown): unknown {
    if (this.isDefaultValue(value)) return value;
    const deserialized = this.subtype.deserialize?.(value) ?? value;
    return this.coder.load(deserialized);
  }

  cast(value: unknown): unknown {
    return value;
  }

  serialize(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (this.isDefaultValue(value)) return undefined;
    const dumped = this.coder.dump(value);
    return this.subtype.serialize?.(dumped) ?? dumped;
  }

  changedInPlace(rawOldValue: unknown, value: unknown): boolean {
    if (value === null || value === undefined) return false;
    const rawNewValue = this.coder.dump(value);
    if (rawOldValue === null && rawNewValue !== null) return true;
    if (rawOldValue !== null && rawNewValue === null) return true;
    return rawOldValue !== rawNewValue;
  }

  assertValidValue(value: unknown): void {
    if (this.coder.assertValidValue) {
      this.coder.assertValidValue(value);
    }
  }

  forceEquality(value: unknown): boolean {
    return this.coder.objectClass !== undefined && value instanceof this.coder.objectClass;
  }

  get serialized(): boolean {
    return true;
  }

  private isDefaultValue(value: unknown): boolean {
    if (value === this._defaultValue) return true;
    if (value === null || value === undefined)
      return this._defaultValue === null || this._defaultValue === undefined;
    if (
      typeof value === "object" &&
      typeof this._defaultValue === "object" &&
      this._defaultValue !== null
    ) {
      return JSON.stringify(value) === JSON.stringify(this._defaultValue);
    }
    return false;
  }
}
