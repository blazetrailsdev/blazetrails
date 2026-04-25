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
    Configurable.config.supportUnencryptedData = true;
    const Post = makeEncryptedPost(freshAdapter());
    const post = await withoutEncryption(() =>
      Post.create({ title: "The Starfleet is here!", body: "take cover!" }),
    );
    // Raw value is plaintext (not encrypted).
    expect(post.readAttributeBeforeTypeCast("title")).toBe("The Starfleet is here!");
    // On next save, encryption is applied.
    await post.update({ title: "Other title" });
    assertEncryptedAttribute(await Post.find(post.id), "title", "Other title");
  });

  it("when :support_unencrypted_data is on, it won't work with unencrypted attributes", async () => {
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
