import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  freshAdapter,
  configureEncryption,
  snapshotEncryptionConfig,
  restoreEncryptionConfig,
  makeEncryptedBookWithBinaryMessagePackSerialized,
  assertEncryptedAttribute,
  Base,
} from "./test-helpers.js";
import { MessagePackMessageSerializer } from "./message-pack-message-serializer.js";
import { Encoding as EncodingError } from "./errors.js";

describe("ActiveRecord::Encryption::EncryptableRecordMessagePackSerializedTest", () => {
  let configSnapshot: ReturnType<typeof snapshotEncryptionConfig>;

  beforeEach(() => {
    configSnapshot = snapshotEncryptionConfig();
    configureEncryption();
  });

  afterEach(() => {
    restoreEncryptionConfig(configSnapshot);
  });

  it("binary data can be serialized with message pack", async () => {
    const Book = makeEncryptedBookWithBinaryMessagePackSerialized(freshAdapter());
    const allBytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const book = await Book.create({ logo: allBytes });
    await assertEncryptedAttribute(book, "logo", allBytes);
  });

  it("binary data can be encrypted uncompressed and serialized with message pack", async () => {
    const Book = makeEncryptedBookWithBinaryMessagePackSerialized(freshAdapter());
    // Strings below 140 bytes are not compressed
    const lowBytes = Uint8Array.from({ length: 128 }, (_, i) => i);
    const highBytes = Uint8Array.from({ length: 128 }, (_, i) => i + 128);
    await assertEncryptedAttribute(await Book.create({ logo: lowBytes }), "logo", lowBytes);
    await assertEncryptedAttribute(await Book.create({ logo: highBytes }), "logo", highBytes);
  });

  it("text columns cannot be serialized with message pack", async () => {
    const adapter = freshAdapter();
    const MsgPackTextBook = class extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.adapter = adapter;
        this.encrypts("name", { messageSerializer: new MessagePackMessageSerializer() });
      }
    } as any;
    await expect(MsgPackTextBook.create({ name: "Dune" })).rejects.toThrow(EncodingError);
  });
});
