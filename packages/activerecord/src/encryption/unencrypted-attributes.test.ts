import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  freshAdapter,
  configureEncryption,
  snapshotEncryptionConfig,
  restoreEncryptionConfig,
  makeEncryptedPost,
  assertEncryptedAttribute,
  withoutEncryption,
} from "./test-helpers.js";
import { Configurable } from "./configurable.js";
import { Decryption as DecryptionError } from "./errors.js";

describe("ActiveRecord::Encryption::UnencryptedAttributesTest", () => {
  let configSnapshot: ReturnType<typeof snapshotEncryptionConfig>;

  beforeEach(() => {
    configSnapshot = snapshotEncryptionConfig();
    configureEncryption();
  });

  afterEach(() => {
    restoreEncryptionConfig(configSnapshot);
  });

  it("when :support_unencrypted_data is off, it works with unencrypted attributes normally", async () => {
    // Rails names this "off" because the strict-encryption restriction is disabled —
    // the system accepts plaintext alongside ciphertext. This maps to
    // supportUnencryptedData = true (tolerant / backwards-compat mode).
    Configurable.config.supportUnencryptedData = true;
    const Post = makeEncryptedPost(freshAdapter());
    new Post();
    const post = await withoutEncryption(() =>
      Post.create({ title: "The Starfleet is here!", body: "take cover!" }),
    );
    // Plaintext is stored unencrypted; reading it back returns the plain value.
    const reloaded = await Post.find(post.id);
    expect(reloaded.title).toBe("The Starfleet is here!");
    // On next save, encryption is applied.
    await post.update({ title: "Other title" });
    assertEncryptedAttribute(await Post.find(post.id), "title", "Other title");
  });

  it("when :support_unencrypted_data is on, it won't work with unencrypted attributes", async () => {
    // Rails names this "on" because the strict-encryption requirement is active —
    // plaintext in an encrypted column is rejected with DecryptionError. This maps
    // to supportUnencryptedData = false (strict mode, no plaintext fallback).
    Configurable.config.supportUnencryptedData = false;
    const Post = makeEncryptedPost(freshAdapter());
    new Post();
    const post = await withoutEncryption(() =>
      Post.create({ title: "The Starfleet is here!", body: "take cover!" }),
    );
    const reloaded = await Post.find(post.id);
    expect(() => reloaded.title).toThrow(DecryptionError);
  });
});
