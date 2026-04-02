/**
 * ActiveRecord::Encryption — declares encrypted attributes.
 *
 * When an attribute is declared with `encrypts()`, its type is wrapped
 * with EncryptedAttributeType which handles encrypt on serialize and
 * decrypt on deserialize — matching Rails' type-system approach.
 *
 * Mirrors: ActiveRecord::Encryption
 */

import { EncryptedAttributeType } from "./encrypted-attribute-type.js";

export interface Encryptor {
  encrypt(value: string): string;
  decrypt(ciphertext: string): string;
}

/**
 * Default encryptor — base64 round-trip.
 * NOT secure — intended as a placeholder.
 * Users should supply a real Encryptor.
 */
export const defaultEncryptor: Encryptor = {
  encrypt(value: string): string {
    return Buffer.from(value, "utf-8").toString("base64");
  },
  decrypt(ciphertext: string): string {
    return Buffer.from(ciphertext, "base64").toString("utf-8");
  },
};

/**
 * Declare one or more attributes as encrypted on a model class.
 *
 * Wraps each named attribute's type with EncryptedAttributeType so that
 * values are encrypted on serialize (save) and decrypted on deserialize (load).
 *
 * Usage (inside a static block on a Base subclass):
 *   encrypts("ssn", "email");
 *   encrypts("secret", { encryptor: myEncryptor });
 */
export function encrypts(klass: any, ...args: Array<string | { encryptor?: Encryptor }>): void {
  let enc: Encryptor = defaultEncryptor;
  const names: string[] = [];

  for (const arg of args) {
    if (typeof arg === "string") {
      names.push(arg);
    } else if (arg && typeof arg === "object" && arg.encryptor) {
      enc = arg.encryptor;
    }
  }

  // Ensure subclass has own definitions before mutating
  if (!Object.prototype.hasOwnProperty.call(klass, "_attributeDefinitions")) {
    klass._attributeDefinitions = new Map(klass._attributeDefinitions);
  }

  for (const name of names) {
    const def = klass._attributeDefinitions.get(name);
    if (def) {
      // Wrap the existing type with encryption
      klass._attributeDefinitions.set(name, {
        ...def,
        type: new EncryptedAttributeType(def.type, enc),
      });
    }
  }
}

/**
 * Check if an attribute is encrypted on a class.
 */
export function isEncryptedAttribute(klass: any, attr: string): boolean {
  let current = klass;
  while (current) {
    const defs = current._attributeDefinitions;
    if (defs) {
      const def = defs.get(attr);
      if (def?.type instanceof EncryptedAttributeType) return true;
    }
    current = Object.getPrototypeOf(current);
  }
  return false;
}
