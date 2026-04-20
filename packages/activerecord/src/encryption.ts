/**
 * Wiring for `Base.encrypts` — records declarations and applies them
 * to the class's attribute definitions.
 *
 * Mirrors: ActiveRecord::Encryption::EncryptableRecord#encrypts
 *
 * In Rails, `encrypts` uses `decorate_attributes` which defers type
 * wrapping via `PendingDecorator` — the actual wrapping happens when
 * `_default_attributes` is first resolved. We mirror this with
 * `_pendingEncryptions`: `encrypts()` records the request, and
 * `applyPendingEncryptions()` runs during construction and after
 * schema reflection, wrapping any attributes that haven't been
 * wrapped yet.
 *
 * All actual encryption flows through the Rails-faithful scheme-based
 * `EncryptedAttributeType` under `./encryption/`. A custom `{ encryptor }`
 * option is adapted into a `Scheme` via a minimal encryptor shim so the
 * two flows share a single wrapper implementation.
 */

import { EncryptedAttributeType } from "./encryption/encrypted-attribute-type.js";
import { Scheme } from "./encryption/scheme.js";

export interface Encryptor {
  encrypt(value: string): string;
  decrypt(ciphertext: string): string;
}

const ENCRYPTED_PREFIX = "AR_ENC:";

export const defaultEncryptor: Encryptor = {
  encrypt(value: string): string {
    return ENCRYPTED_PREFIX + Buffer.from(value, "utf-8").toString("base64");
  },
  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
      throw new Error("Not an encrypted value");
    }
    return Buffer.from(ciphertext.slice(ENCRYPTED_PREFIX.length), "base64").toString("utf-8");
  },
};

/**
 * Adapts the simple `{ encrypt, decrypt }` pair accepted by `Base.encrypts`
 * to the wider surface that `Scheme.encryptor` expects (options-aware
 * encrypt/decrypt plus `encrypted(text)`). Options are intentionally
 * ignored — the legacy path has no key provider or deterministic mode.
 */
class LegacyEncryptorShim {
  constructor(private readonly inner: Encryptor) {}

  encrypt(clearText: string, _options?: Record<string, unknown>): string {
    return this.inner.encrypt(clearText);
  }

  decrypt(encryptedText: string, _options?: Record<string, unknown>): string {
    return this.inner.decrypt(encryptedText);
  }

  encrypted(text: string): boolean {
    try {
      this.inner.decrypt(text);
      return true;
    } catch {
      return false;
    }
  }
}

function schemeFor(encryptor: Encryptor): Scheme {
  return new Scheme({ encryptor: new LegacyEncryptorShim(encryptor) as never });
}

interface PendingEncryption {
  name: string;
  encryptor: Encryptor;
}

/**
 * Declare one or more attributes as encrypted on a model class.
 *
 * Like Rails' `decorate_attributes`, this defers the actual type wrapping.
 * Pending encryptions are applied when the attribute definitions are
 * first used (via `applyPendingEncryptions`).
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

  if (!Object.prototype.hasOwnProperty.call(klass, "_pendingEncryptions")) {
    klass._pendingEncryptions = [...(klass._pendingEncryptions ?? [])];
  }

  for (const name of names) {
    klass._pendingEncryptions.push({ name, encryptor: enc });
  }

  if (klass._attributeDefinitions?.size > 0) {
    applyPendingEncryptions(klass);
  }
}

/**
 * Apply any pending encryption decorations to the class's attribute
 * definitions. Wraps the existing cast type with the scheme-based
 * `EncryptedAttributeType` via a `Scheme` backed by the declared
 * encryptor shim.
 */
export function applyPendingEncryptions(klass: any): void {
  const pending: PendingEncryption[] | undefined = klass._pendingEncryptions;
  if (!pending || pending.length === 0) return;

  if (!Object.prototype.hasOwnProperty.call(klass, "_attributeDefinitions")) {
    klass._attributeDefinitions = new Map(klass._attributeDefinitions);
  }

  for (const { name, encryptor } of pending) {
    const def = klass._attributeDefinitions.get(name);
    if (!def) continue;
    if (def.type instanceof EncryptedAttributeType) continue;
    klass._attributeDefinitions.set(name, {
      ...def,
      type: new EncryptedAttributeType({
        scheme: schemeFor(encryptor),
        castType: def.type,
      }),
    });
  }
}

/**
 * Check if an attribute is encrypted on a class (pending or applied).
 */
export function isEncryptedAttribute(klass: any, attr: string): boolean {
  let current = klass;
  while (current) {
    const pending: PendingEncryption[] | undefined = current._pendingEncryptions;
    if (pending?.some((p) => p.name === attr)) return true;
    const defs = current._attributeDefinitions;
    if (defs) {
      const def = defs.get(attr);
      if (def?.type instanceof EncryptedAttributeType) return true;
    }
    current = Object.getPrototypeOf(current);
  }
  return false;
}
