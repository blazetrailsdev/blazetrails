import { Type } from "@blazetrails/activemodel";
import type { Encryptor } from "./encryption.js";

/**
 * Type decorator that transparently encrypts/decrypts attribute values.
 *
 * Mirrors: ActiveRecord::Encryption::EncryptedAttributeType
 *
 * Wraps an existing type. Values are stored encrypted (serialize → encrypt),
 * and decrypted on read (deserialize → decrypt). The inner type handles
 * normal casting; this layer adds the encryption envelope.
 */
export class EncryptedAttributeType extends Type<unknown> {
  readonly name: string;
  private readonly innerType: Type;
  private readonly encryptor: Encryptor;

  constructor(innerType: Type, encryptor: Encryptor) {
    super();
    this.innerType = innerType;
    this.encryptor = encryptor;
    this.name = innerType.name;
  }

  cast(value: unknown): unknown {
    return this.innerType.cast(value);
  }

  deserialize(value: unknown): unknown {
    if (typeof value === "string") {
      try {
        value = this.encryptor.decrypt(value);
      } catch {
        // If decryption fails, pass through — value may not be encrypted
      }
    }
    return this.innerType.deserialize(value);
  }

  serialize(value: unknown): unknown {
    const serialized = this.innerType.serialize(value);
    if (typeof serialized === "string") {
      return this.encryptor.encrypt(serialized);
    }
    return serialized;
  }

  isChanged(oldValue: unknown, newValue: unknown, newValueBeforeTypeCast?: unknown): boolean {
    return this.innerType.isChanged(oldValue, newValue, newValueBeforeTypeCast);
  }
}
