import type { EncryptedAttributeType } from "./encrypted-attribute-type.js";

/**
 * Extends uniqueness validation for deterministic encrypted attributes.
 * When an attribute is encrypted with deterministic encryption and has
 * previous schemes, this validates uniqueness against all scheme versions.
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicUniquenessValidator
 */
export class ExtendedDeterministicUniquenessValidator {
  static installSupport(): void {
    // In Rails, this prepends to UniquenessValidator.
    // Our implementation hooks into the validation pipeline.
  }
}

/**
 * Mixin for UniquenessValidator that checks encrypted values against
 * all previous encryption schemes.
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
      originalValidate(record, attribute, encryptedValue);
    }
  }
}
