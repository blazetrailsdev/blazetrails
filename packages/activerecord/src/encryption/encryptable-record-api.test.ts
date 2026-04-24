import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  freshAdapter,
  configureEncryption,
  snapshotEncryptionConfig,
  restoreEncryptionConfig,
  makeEncryptedPost,
  makeEncryptedBook,
  makeEncryptedAuthor,
  assertEncryptedAttribute,
  withoutEncryption,
  Base,
} from "./test-helpers.js";
import { Configurable } from "./configurable.js";

describe("ActiveRecord::Encryption::EncryptableRecordApiTest", () => {
  let configSnapshot: ReturnType<typeof snapshotEncryptionConfig>;

  beforeEach(() => {
    configSnapshot = snapshotEncryptionConfig();
    Configurable.config.previousSchemes = [];
    configureEncryption();
    Configurable.config.supportUnencryptedData = true;
  });

  afterEach(() => {
    restoreEncryptionConfig(configSnapshot);
  });

  it("encrypt encrypts all the encryptable attributes", async () => {
    const Post = makeEncryptedPost(freshAdapter());
    const title = "The Starfleet is here!";
    const body = "<p>the Starfleet is here, we are safe now!</p>";

    const post = await withoutEncryption(() => Post.create({ title, body }));
    await post.encrypt();

    assertEncryptedAttribute(post, "title", title);
    assertEncryptedAttribute(post, "body", body);
  });

  it("encrypt won't fail for classes without attributes to encrypt", async () => {
    const adapter = freshAdapter();
    const PlainPost = class extends (Base as any) {
      static {
        this.attribute("id", "integer");
        this.attribute("title", "string");
        this.adapter = adapter;
      }
    } as any;
    const post = await PlainPost.create({ title: "hello" });
    await expect(post.encrypt()).resolves.toBeUndefined();
  });

  it("decrypt decrypts encrypted attributes", async () => {
    const Post = makeEncryptedPost(freshAdapter());
    const title = "the Starfleet is here!";
    const body = "<p>the Starfleet is here, we are safe now!</p>";
    const post = await Post.create({ title, body });
    assertEncryptedAttribute(post, "title", title);

    await post.decrypt();

    const reloaded = await Post.find(post.id);
    expect(reloaded.readAttributeBeforeTypeCast("title")).toBe(title);
    expect(reloaded.title).toBe(title);
  });

  it("decrypt can be invoked multiple times", async () => {
    const Post = makeEncryptedPost(freshAdapter());
    const post = await Post.create({
      title: "the Starfleet is here",
      body: "<p>the Starfleet is here, we are safe now!</p>",
    });

    for (let i = 0; i < 3; i++) await post.decrypt();

    const reloaded = await Post.find(post.id);
    expect(reloaded.readAttributeBeforeTypeCast("title")).toBe("the Starfleet is here");
  });

  it("encrypt can be invoked multiple times", async () => {
    const Post = makeEncryptedPost(freshAdapter());
    const post = await Post.create({
      title: "the Starfleet is here",
      body: "<p>the Starfleet is here, we are safe now!</p>",
    });

    for (let i = 0; i < 3; i++) await post.encrypt();

    const reloaded = await Post.find(post.id);
    assertEncryptedAttribute(reloaded, "title", "the Starfleet is here");
  });

  it("encrypted_attribute? returns false for regular attributes", async () => {
    const Book = makeEncryptedBook(freshAdapter());
    const book = await Book.create({ name: "Dune" });
    expect(book.encryptedAttribute("id")).toBe(false);
  });

  it("encrypted_attribute? returns true for encrypted attributes which content is encrypted", async () => {
    const Book = makeEncryptedBook(freshAdapter());
    const book = await Book.create({ name: "Dune" });
    // Reload so readAttributeBeforeTypeCast returns the DB ciphertext, not the in-memory plaintext.
    const reloaded = await Book.find(book.id);
    expect(reloaded.encryptedAttribute("name")).toBe(true);
  });

  it("encrypted_attribute? returns false for encrypted attributes which content is not encrypted", async () => {
    const Book = makeEncryptedBook(freshAdapter());
    const book = await withoutEncryption(() => Book.create({ name: "Dune" }));
    expect(book.encryptedAttribute("name")).toBe(false);
  });

  it("ciphertext_for returns the ciphertext for a given attribute", async () => {
    const Book = makeEncryptedBook(freshAdapter());
    const book = await Book.create({ name: "Dune" });
    const ciphertext = book.ciphertextFor("name");
    expect(typeof ciphertext).toBe("string");
    expect(ciphertext).not.toBe("Dune");
    // Verify the ciphertext decrypts to the correct value.
    const type = (Book as any)._attributeDefinitions?.get("name")?.type;
    expect(type.deserialize(ciphertext)).toBe("Dune");
  });

  it("ciphertext_for returns the persisted ciphertext for a non-deterministically encrypted attribute", async () => {
    const Post = makeEncryptedPost(freshAdapter());
    const post = await Post.create({
      title: "Fear is the mind-killer",
      body: "Fear is the little-death...",
    });
    // Reload so readAttributeBeforeTypeCast returns the persisted DB ciphertext.
    const reloaded = await Post.find(post.id);
    const ciphertext = reloaded.ciphertextFor("title");
    expect(ciphertext).toBe(reloaded.readAttributeBeforeTypeCast("title"));
    const type = (Post as any)._attributeDefinitions?.get("title")?.type;
    expect(type.deserialize(ciphertext)).toBe("Fear is the mind-killer");
  });

  it("ciphertext_for returns the ciphertext of a new value", async () => {
    const Book = makeEncryptedBook(freshAdapter());
    const book = await Book.create({ name: "Dune" });
    book.name = "Arrakis";
    const ciphertext = book.ciphertextFor("name");
    const type = (Book as any)._attributeDefinitions?.get("name")?.type;
    expect(type.deserialize(ciphertext)).toBe("Arrakis");
  });

  it("ciphertext_for returns the ciphertext of a decrypted value", async () => {
    const Book = makeEncryptedBook(freshAdapter());
    const book = await Book.create({ name: "Dune" });
    await book.decrypt();
    const ciphertext = book.ciphertextFor("name");
    const type = (Book as any)._attributeDefinitions?.get("name")?.type;
    expect(type.deserialize(ciphertext)).toBe("Dune");
  });

  it("ciphertext_for returns the ciphertext of a value when the record is new", () => {
    const Book = makeEncryptedBook(freshAdapter());
    const book = new Book() as any;
    book.name = "Dune";
    const ciphertext = book.ciphertextFor("name");
    const type = (Book as any)._attributeDefinitions?.get("name")?.type;
    expect(type.deserialize(ciphertext)).toBe("Dune");
  });

  it("encrypt attributes encrypted with a previous encryption scheme", async () => {
    const Author = makeEncryptedAuthor(freshAdapter());
    const author = await Author.create({ name: "david" });

    // Store a value encrypted with a previous type scheme
    const type = (Author as any)._attributeDefinitions?.get("name")?.type;
    const prevType = type.previousTypes[0];
    const oldCiphertext = prevType ? prevType.serialize("dhh") : null;

    if (oldCiphertext) {
      await withoutEncryption(() => author.updateColumns({ name: oldCiphertext }));
      await author.encrypt();
      const reloaded = await Author.find(author.id);
      expect(reloaded.name).toBe("dhh");
    }
  });

  it.skip("encrypt won't change the encoding of strings even when compression is used", () => {});
  it.skip("encrypt will honor forced encoding for deterministic attributes", () => {});
  it.skip("encrypt won't force encoding for deterministic attributes when option is nil", () => {});
  it.skip("encrypt will preserve case when :ignore_case option is used", () => {});
  it.skip("re-encrypting will preserve case when :ignore_case option is used", () => {});
});
