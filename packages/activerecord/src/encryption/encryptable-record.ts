import { Scheme, type SchemeOptions } from "./scheme.js";
import { EncryptedAttributeType } from "./encrypted-attribute-type.js";
import { Configurable } from "./configurable.js";

/**
 * Provides the `encrypts` declaration for model classes, enabling
 * transparent attribute encryption/decryption.
 *
 * Mirrors: ActiveRecord::Encryption::EncryptableRecord
 *
 * Usage:
 *   EncryptableRecord.encrypts(User, "email", { deterministic: true })
 */
export class EncryptableRecord {
  /**
   * Declare that attributes should be encrypted. Registers an
   * EncryptedAttributeType for each named attribute.
   */
  static encrypts(modelClass: any, ...namesAndOptions: unknown[]): void {
    let options: SchemeOptions = {};
    const names: string[] = [];

    for (const arg of namesAndOptions) {
      if (typeof arg === "string") {
        names.push(arg);
      } else if (typeof arg === "object" && arg !== null) {
        options = arg as SchemeOptions;
      }
    }

    const scheme = new Scheme(options);

    if (!modelClass._encryptedAttributes) {
      modelClass._encryptedAttributes = new Set<string>();
    }

    for (const name of names) {
      modelClass._encryptedAttributes.add(name);

      const type = new EncryptedAttributeType({
        scheme,
        castType: modelClass.typeForAttribute?.(name),
      });

      if (modelClass.attribute) {
        modelClass.attribute(name, type);
      }

      Configurable.encryptedAttributeWasDeclared(modelClass, name);
    }
  }

  /**
   * Check if a model class has any encrypted attributes declared.
   */
  static hasEncryptedAttributes(modelClass: any): boolean {
    return (modelClass._encryptedAttributes?.size ?? 0) > 0;
  }

  /**
   * Get the set of encrypted attribute names for a model class.
   */
  static encryptedAttributes(modelClass: any): Set<string> {
    return modelClass._encryptedAttributes ?? new Set();
  }

  /**
   * Get the set of deterministic encrypted attribute names.
   */
  static deterministicEncryptedAttributes(modelClass: any): Set<string> {
    const result = new Set<string>();
    for (const name of this.encryptedAttributes(modelClass)) {
      const type = modelClass.typeForAttribute?.(name);
      if (type instanceof EncryptedAttributeType && type.deterministic) {
        result.add(name);
      }
    }
    return result;
  }
}
