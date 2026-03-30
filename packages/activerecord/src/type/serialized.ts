/**
 * Mirrors: ActiveRecord::Type::Serialized
 *
 * Wraps a subtype with a coder (JSON, YAML, etc.) for serialized columns.
 */
import { Type } from "@blazetrails/activemodel";

export interface Coder {
  load(value: unknown): unknown;
  dump(value: unknown): unknown;
  assertValidValue?(value: unknown, options?: { action: string }): void;
  objectClass?: new (...args: any[]) => unknown;
}

export class Serialized extends Type<unknown> {
  readonly name = "serialized";
  readonly subtype: Type<unknown>;
  readonly coder: Coder;

  constructor(subtype: Type<unknown>, coder: Coder) {
    super();
    this.subtype = subtype;
    this.coder = coder;
  }

  cast(value: unknown): unknown {
    return this.subtype.cast(value);
  }

  deserialize(value: unknown): unknown {
    if (this._isDefault(value)) return value;
    return this.coder.load(this.subtype.deserialize(value));
  }

  serialize(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (this._isDefault(value)) return undefined;
    return this.subtype.serialize(this.coder.dump(value));
  }

  changedInPlace(rawOldValue: unknown, value: unknown): boolean {
    if (value === null || value === undefined) return false;
    const rawNewValue = this._encoded(value);
    return rawOldValue !== rawNewValue;
  }

  assertValidValue(value: unknown): void {
    if (this.coder.assertValidValue) {
      this.coder.assertValidValue(value, { action: "serialize" });
    }
  }

  forceEquality(value: unknown): boolean {
    return !!(this.coder.objectClass && value instanceof this.coder.objectClass);
  }

  get serialized(): boolean {
    return true;
  }

  private _isDefault(value: unknown): boolean {
    return value === this.coder.load(null);
  }

  private _encoded(value: unknown): unknown {
    if (this._isDefault(value)) return undefined;
    return this.coder.dump(value);
  }
}
