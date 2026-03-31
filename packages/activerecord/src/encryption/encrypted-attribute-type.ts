import { Type, StringType } from "@blazetrails/activemodel";
import type { Scheme } from "./scheme.js";
import { Encryptor } from "./encryptor.js";
import { Decryption } from "./errors.js";

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
    if (typeof casted !== "string") return casted;
    const toEncrypt = this.scheme.downcase ? casted.toLowerCase() : casted;
    return this.encrypt(toEncrypt);
  }

  changedInPlace(rawOldValue: unknown, newValue: unknown): boolean {
    const oldValue = rawOldValue === null ? null : this.deserialize(rawOldValue);
    return oldValue !== newValue;
  }

  encrypted(value: unknown): boolean {
    if (typeof value !== "string") return false;
    try {
      this._encryptor.decrypt(value, { keyProvider: this.scheme.keyProvider as any });
      return true;
    } catch {
      return false;
    }
  }

  get deterministic(): boolean {
    return this.scheme.deterministic ?? false;
  }

  get previousTypes(): EncryptedAttributeType[] {
    return ((this.scheme as any).previousSchemes ?? []).map(
      (s: Scheme) => new EncryptedAttributeType({ scheme: s, previousType: true }),
    );
  }

  private decrypt(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (this._default !== undefined && this._default === value) return value;
    try {
      return this._encryptor.decrypt(String(value), {
        keyProvider: this.scheme.keyProvider as any,
      });
    } catch (error) {
      if (error instanceof Decryption && this.supportUnencryptedData) {
        return value;
      }
      throw error;
    }
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
