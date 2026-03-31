import type { EncryptedAttributeType } from "./encrypted-attribute-type.js";
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
 * For each previous encryption type, serializes the value and validates
 * uniqueness with encryption disabled (comparing raw ciphertexts).
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
    originalValidate(record, attribute, value);

    const klass = record.constructor;
    const deterministicAttrs = klass._encryptedAttributes;
    if (!deterministicAttrs?.has(attribute)) return;

    const type = klass.typeForAttribute?.(attribute) as EncryptedAttributeType | undefined;
    if (!type?.previousTypes?.length) return;

    for (const prevType of type.previousTypes) {
      const encryptedValue = prevType.serialize(value);
      Contexts.withoutEncryption(() => {
        originalValidate(record, attribute, encryptedValue);
      });
    }
  }
}
