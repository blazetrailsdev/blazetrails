import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import { Cipher } from "./cipher.js";
import { DecryptionError } from "./errors.js";

function generateKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

describe("ActiveRecord::Encryption::CipherTest", () => {
  it("encrypts and decrypts a round-trip", () => {
    const cipher = new Cipher();
    const key = generateKey();
    const encrypted = cipher.encrypt("hello world", key);
    expect(cipher.decrypt(encrypted, key)).toBe("hello world");
  });

  it("decrypt accepts an array of keys and tries each", () => {
    const cipher = new Cipher();
    const oldKey = generateKey();
    const newKey = generateKey();
    const encrypted = cipher.encrypt("secret", oldKey);
    expect(cipher.decrypt(encrypted, [newKey, oldKey])).toBe("secret");
  });

  it("decrypt raises DecryptionError when no key works", () => {
    const cipher = new Cipher();
    const key = generateKey();
    const wrongKey = generateKey();
    const encrypted = cipher.encrypt("secret", key);
    expect(() => cipher.decrypt(encrypted, wrongKey)).toThrow(DecryptionError);
  });

  it("decrypt raises DecryptionError for malformed input", () => {
    const cipher = new Cipher();
    expect(() => cipher.decrypt("not-json", generateKey())).toThrow(DecryptionError);
  });

  it("deterministic encryption produces the same ciphertext", () => {
    const cipher = new Cipher();
    const key = generateKey();
    const a = cipher.encrypt("stable", key, { deterministic: true });
    const b = cipher.encrypt("stable", key, { deterministic: true });
    expect(a).toBe(b);
  });

  it("non-deterministic encryption produces different ciphertext each time", () => {
    const cipher = new Cipher();
    const key = generateKey();
    const a = cipher.encrypt("stable", key);
    const b = cipher.encrypt("stable", key);
    expect(a).not.toBe(b);
  });

  it("keyLength and ivLength delegate to AES implementation", () => {
    const cipher = new Cipher();
    expect(cipher.keyLength()).toBe(32);
    expect(cipher.ivLength()).toBe(12);
  });
});
