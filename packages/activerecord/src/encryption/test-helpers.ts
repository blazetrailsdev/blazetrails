/**
 * Shared helpers for DB-backed encryption tests.
 *
 * Mirrors: ActiveRecord::EncryptionTestCase (setup/teardown) and
 *          ActiveRecord::Encryption::EncryptionHelpers (assertions).
 */

import { createTestAdapter } from "../test-adapter.js";
import { Base } from "../index.js";
import type { DatabaseAdapter } from "../adapter.js";
import { Configurable } from "./configurable.js";
import { Contexts } from "./contexts.js";
import { DerivedSecretKeyProvider } from "./derived-secret-key-provider.js";
import { withEncryptionContext, withoutEncryption } from "./context.js";
import { DecryptionError } from "./errors.js";

export { withEncryptionContext, withoutEncryption, DecryptionError };

// ─── Test key material ────────────────────────────────────────────────────────

// Primary key is used as a PBKDF2 password — any string works.
export const TEST_PRIMARY_KEY = "test-primary-key-for-encryption-suite";
// Deterministic key is used as raw AES key material (base64-encoded 32 bytes).
// "test-deterministic-key-32bytes!!" = exactly 32 bytes, base64-encoded.
export const TEST_DETERMINISTIC_KEY = "dGVzdC1kZXRlcm1pbmlzdGljLWtleS0zMmJ5dGVzISE=";
export const TEST_KEY_DERIVATION_SALT = "test-key-derivation-salt-for-encryption";

// ─── Config snapshot/restore ─────────────────────────────────────────────────

interface ConfigSnapshot {
  primaryKey: string | string[] | undefined;
  deterministicKey: string | undefined;
  keyDerivationSalt: string | undefined;
  supportUnencryptedData: boolean;
  previousSchemes: typeof Configurable.config.previousSchemes;
}

export function snapshotEncryptionConfig(): ConfigSnapshot {
  const c = Configurable.config;
  return {
    primaryKey: c.primaryKey,
    deterministicKey: c.deterministicKey,
    keyDerivationSalt: c.keyDerivationSalt,
    supportUnencryptedData: c.supportUnencryptedData,
    previousSchemes: [...c.previousSchemes],
  };
}

export function restoreEncryptionConfig(snapshot: ConfigSnapshot): void {
  const c = Configurable.config;
  c.primaryKey = snapshot.primaryKey;
  c.deterministicKey = snapshot.deterministicKey;
  c.keyDerivationSalt = snapshot.keyDerivationSalt;
  c.supportUnencryptedData = snapshot.supportUnencryptedData;
  c.previousSchemes = snapshot.previousSchemes;
  Contexts.resetDefaultContext();
}

export function configureEncryption(
  overrides: Partial<{
    primaryKey: string;
    deterministicKey: string;
    keyDerivationSalt: string;
    supportUnencryptedData: boolean;
  }> = {},
): void {
  Configurable.configure({
    primaryKey: overrides.primaryKey ?? TEST_PRIMARY_KEY,
    deterministicKey: overrides.deterministicKey ?? TEST_DETERMINISTIC_KEY,
    keyDerivationSalt: overrides.keyDerivationSalt ?? TEST_KEY_DERIVATION_SALT,
  });
  if (overrides.supportUnencryptedData !== undefined) {
    Configurable.config.supportUnencryptedData = overrides.supportUnencryptedData;
  }
}

// ─── Test adapter factory ─────────────────────────────────────────────────────

export function freshAdapter(): DatabaseAdapter {
  return createTestAdapter();
}

// ─── Model factories ──────────────────────────────────────────────────────────

/**
 * EncryptedPost: title and body are both encrypted (non-deterministic).
 * Mirrors Rails' post_encrypted.rb / EncryptedPost.
 */
export function makeEncryptedPost(adapter: DatabaseAdapter) {
  return class EncryptedPost extends Base {
    static {
      this.attribute("id", "integer");
      this.attribute("title", "string");
      this.attribute("body", "string");
      this.adapter = adapter;
      this.encrypts("title");
      this.encrypts("body");
    }
  } as any;
}

/**
 * EncryptedBook: name is encrypted deterministically.
 * Mirrors Rails' book_encrypted.rb / EncryptedBook.
 */
export function makeEncryptedBook(adapter: DatabaseAdapter) {
  return class EncryptedBook extends Base {
    static {
      this.attribute("id", "integer");
      this.attribute("name", "string");
      this.adapter = adapter;
      this.encrypts("name", { deterministic: true });
    }
  } as any;
}

export function makeEncryptedBookWithDowncaseName(adapter: DatabaseAdapter) {
  return class EncryptedBookWithDowncaseName extends Base {
    static {
      this.attribute("id", "integer");
      this.attribute("name", "string");
      this.adapter = adapter;
      this.encrypts("name", { deterministic: true, downcase: true });
    }
  } as any;
}

export function makeEncryptedBookIgnoreCase(adapter: DatabaseAdapter) {
  return class EncryptedBookIgnoreCase extends Base {
    static {
      this.attribute("id", "integer");
      this.attribute("name", "string");
      this.adapter = adapter;
      this.encrypts("name", { deterministic: true, ignoreCase: true });
    }
  } as any;
}

export function makeEncryptedAuthor(adapter: DatabaseAdapter) {
  return class EncryptedAuthor extends Base {
    static {
      this.attribute("id", "integer");
      this.attribute("name", "string");
      this.adapter = adapter;
      this.encrypts("name");
    }
  } as any;
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

/**
 * Mirrors Rails' assert_encrypted_attribute.
 * Checks that the serialized (DB) form is ciphertext (≠ plaintext) and
 * that reading the attribute returns the expected plaintext.
 *
 * Uses the attribute type's serialize() to get the ciphertext form rather
 * than readAttributeBeforeTypeCast, which returns the in-memory before-cast
 * value (not the DB ciphertext for in-memory created records).
 */
export function assertEncryptedAttribute(
  model: any,
  attrName: string,
  expectedValue: unknown,
): void {
  // Verify the attribute reads back as the expected plaintext.
  const readValue = model[attrName];
  if (readValue !== expectedValue) {
    throw new Error(
      `assertEncryptedAttribute: expected ${attrName} to equal ` +
        `${JSON.stringify(expectedValue)}, got ${JSON.stringify(readValue)}`,
    );
  }

  // Verify the serialized form (what goes to DB) differs from the plaintext.
  if (expectedValue !== null && expectedValue !== undefined && expectedValue !== "") {
    const klass = model.constructor as any;
    const typeDef = klass._attributeDefinitions?.get?.(attrName);
    const type = typeDef?.type;
    if (type && typeof type.serialize === "function") {
      const serialized = type.serialize(expectedValue);
      if (serialized === expectedValue) {
        throw new Error(
          `assertEncryptedAttribute: expected ${attrName} to be encrypted ` +
            `(serialized ≠ plaintext), but serialize returned the plaintext unchanged.`,
        );
      }
    }
  }
}

/**
 * Returns the serialized (encrypted) form of an attribute's current value.
 * Mirrors Rails' model.ciphertext_for(:attr) — the value as stored in the DB.
 */
/**
 * Returns a freshly-serialized (encrypted) form of the attribute's current value.
 *
 * For deterministic encryption, serialize() is idempotent so this equals the
 * stored DB ciphertext. For non-deterministic encryption, a fresh IV is used
 * each call — use this only for comparing two freshly-serialized values (e.g.,
 * to assert two records produce different ciphertexts), not for reading back
 * what's actually stored in the DB.
 *
 * Mirrors Rails' model.ciphertext_for(:attr) in spirit — use with the same
 * caveat that Rails' version reads from the DB whereas this re-serializes.
 */
export function ciphertextFor(model: any, attrName: string): unknown {
  const klass = model.constructor as any;
  const type = klass._attributeDefinitions?.get?.(attrName)?.type;
  if (type && typeof type.serialize === "function" && typeof type.isEncrypted === "function") {
    const value = model[attrName];
    return type.serialize(value);
  }
  return model.readAttributeBeforeTypeCast(attrName);
}

/**
 * Creates a DerivedSecretKeyProvider from a password using the current config.
 */
export function makeKeyProvider(password: string) {
  return new DerivedSecretKeyProvider(password);
}
