import { Type, StringType } from "@blazetrails/activemodel";
import type { Scheme } from "./scheme.js";
import { Encryptor } from "./encryptor.js";

/**
 * An ActiveModel type that encrypts/decrypts attribute values. This is
 * the central piece connecting the encryption system with `encrypts`
 * declarations in model classes.
 *
 * Mirrors: ActiveRecord::Encryption::EncryptedAttributeType
 */
export class EncryptedAttributeType extends Type {
  readonly name = "encrypted";
  readonly scheme: Scheme;
  readonly castType: Type;
  private _previousType: boolean;
  private _default?: unknown;
  private _encryptor: Encryptor;

  constructor(options: {
    scheme: Scheme;
    castType?: Type;
    previousType?: boolean;
    default?: unknown;
  }) {
    super();
    this.scheme = options.scheme;
    this.castType = options.castType ?? new StringType();
    this._previousType = options.previousType ?? false;
    this._default = options.default;
    this._encryptor = new Encryptor();
  }

  cast(value: unknown): unknown {
    return this.castType.cast(value);
  }

  deserialize(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    const decrypted = this.decrypt(value);
    return this.castType.deserialize?.(decrypted) ?? decrypted;
  }

  serialize(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    const casted = this.castType.serialize?.(value) ?? value;
    if (casted === null || casted === undefined) return null;
    const str = typeof casted === "string" ? casted : String(casted);
    const toEncrypt = this.scheme.downcase ? str.toLowerCase() : str;
    return this.encrypt(toEncrypt);
  }

  changedInPlace(rawOldValue: unknown, newValue: unknown): boolean {
    const oldValue = rawOldValue === null ? null : this.deserialize(rawOldValue);
    return oldValue !== newValue;
  }

  encrypted(value: unknown): boolean {
    if (typeof value !== "string") return false;
    return this._encryptor.encrypted(value);
  }

  get deterministic(): boolean {
    return this.scheme.deterministic ?? false;
  }

  get previousTypes(): EncryptedAttributeType[] {
    return ((this.scheme as any).previousSchemes ?? []).map(
      (s: Scheme) =>
        new EncryptedAttributeType({
          scheme: s,
          castType: this.castType,
          previousType: true,
          default: this._default,
        }),
    );
  }

  private decrypt(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (this._default !== undefined && this._default === value) return value;

    // If supporting unencrypted data, check format first
    if (this.supportUnencryptedData && !this.encrypted(value)) {
      return value;
    }

    return this._encryptor.decrypt(String(value), {
      keyProvider: this.scheme.keyProvider as any,
    });
  }

  private encrypt(value: string): string {
    return this._encryptor.encrypt(value, {
      keyProvider: this.scheme.keyProvider as any,
      deterministic: this.scheme.deterministic,
    });
  }

  private get supportUnencryptedData(): boolean {
    return !this._previousType;
  }
}
