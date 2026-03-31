import { EncryptedAttributeType } from "./encrypted-attribute-type.js";
import { getAttributeType } from "./encryptable-record.js";

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
 * For each previous encryption type, temporarily swaps typeForAttribute
 * so the query builder uses the previous scheme's serialize, then
 * restores the original.
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
    const type = getAttributeType(klass, attribute);
    if (!(type instanceof EncryptedAttributeType) || !type.deterministic) {
      originalValidate(record, attribute, value);
      return;
    }

    // Validate with current encryption scheme
    originalValidate(record, attribute, value);

    // Validate against each previous scheme by temporarily swapping
    // typeForAttribute so the query layer uses the previous type
    const originalTypeForAttribute = klass.typeForAttribute;
    for (const prevType of type.previousTypes) {
      klass.typeForAttribute = (attr: string) => {
        if (attr === attribute) return prevType;
        return originalTypeForAttribute ? originalTypeForAttribute.call(klass, attr) : undefined;
      };
      try {
        originalValidate(record, attribute, value);
      } finally {
        klass.typeForAttribute = originalTypeForAttribute;
      }
    }
  }
}
