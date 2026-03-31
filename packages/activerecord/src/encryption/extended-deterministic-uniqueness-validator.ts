import { EncryptedAttributeType } from "./encrypted-attribute-type.js";
import { Contexts } from "./contexts.js";

/**
 * Extends uniqueness validation for deterministic encrypted attributes.
 * When validating uniqueness, also checks against values encrypted with
 * previous schemes to prevent duplicates across migration periods.
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicUniquenessValidator
 */
export class ExtendedDeterministicUniquenessValidator {
  private static _installed = false;

  static installSupport(): void {
    this._installed = true;
  }

  static get installed(): boolean {
    return this._installed;
  }
}

/**
 * Performs uniqueness validation across all encryption scheme versions.
 * For each previous encryption type, serializes the value to its
 * ciphertext and validates uniqueness against the raw ciphertext
 * (with encryption disabled so the query doesn't double-encrypt).
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicUniquenessValidator::EncryptedUniquenessValidator
 */
export class EncryptedUniquenessValidator {
  static validateEncryptedUniqueness(
    record: any,
    attribute: string,
    value: unknown,
    originalValidate: (record: any, attribute: string, value: unknown) => void,
  ): void {
    const klass = record.constructor;
    const type = klass.typeForAttribute?.(attribute);
    if (!(type instanceof EncryptedAttributeType) || !type.deterministic) {
      originalValidate(record, attribute, value);
      return;
    }

    // Validate against current ciphertext
    const currentCiphertext = type.serialize(value);
    Contexts.withoutEncryption(() => {
      originalValidate(record, attribute, currentCiphertext);
    });

    // Validate against previous scheme ciphertexts
    for (const prevType of type.previousTypes) {
      const previousCiphertext = prevType.serialize(value);
      Contexts.withoutEncryption(() => {
        originalValidate(record, attribute, previousCiphertext);
      });
    }
  }
}
