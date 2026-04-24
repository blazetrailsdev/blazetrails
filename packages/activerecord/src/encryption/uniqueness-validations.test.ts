import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  freshAdapter,
  configureEncryption,
  snapshotEncryptionConfig,
  restoreEncryptionConfig,
  makeEncryptedBookWithDowncaseName,
  makeFreshModel,
} from "./test-helpers.js";
import { Configurable } from "./configurable.js";
import { installExtendedQueriesIfConfigured } from "./install.js";
import { ExtendedDeterministicUniquenessValidator } from "./extended-deterministic-uniqueness-validator.js";
import { UniquenessValidator } from "../validations.js";

describe("ActiveRecord::Encryption::UniquenessValidationsTest", () => {
  let configSnapshot: ReturnType<typeof snapshotEncryptionConfig>;
  let savedExtendQueries: boolean;

  beforeEach(() => {
    configSnapshot = snapshotEncryptionConfig();
    savedExtendQueries = Configurable.config.extendQueries;
    Configurable.config.previousSchemes = [];
    configureEncryption();
    // Install extended uniqueness validator so previous-scheme ciphertexts
    // are checked during uniqueness validation.
    Configurable.config.extendQueries = true;
    installExtendedQueriesIfConfigured();
  });

  afterEach(() => {
    restoreEncryptionConfig(configSnapshot);
    Configurable.config.extendQueries = savedExtendQueries;
    // Restore the original UniquenessValidator#validateEach to prevent
    // cross-test pollution in shared Vitest workers.
    ExtendedDeterministicUniquenessValidator.resetSupport(UniquenessValidator);
  });

  it("uniqueness validations work", async () => {
    const Book = makeEncryptedBookWithDowncaseName(freshAdapter());
    Book.validatesUniqueness("name");
    new Book();

    await Book.create({ name: "dune" });
    const dup = await Book.create({ name: "dune" });
    expect(dup.errors.count).toBeGreaterThan(0);
  });

  it.skip("uniqueness validations work when mixing encrypted an unencrypted data", () => {
    // requires same adapter/table access from two different model classes
  });

  it.skip("uniqueness validations do not work when mixing encrypted an unencrypted data and unencrypted data is opted out per-attribute", () => {
    // needs supportUnencryptedData per-attribute option
  });

  it.skip("uniqueness validations work when mixing encrypted an unencrypted data and unencrypted data is opted in per-attribute", () => {
    // needs supportUnencryptedData per-attribute option
  });

  it("uniqueness validations work when using old encryption schemes", async () => {
    Configurable.config.supportUnencryptedData = false;
    Configurable.config.previous = [{ downcase: true, deterministic: true } as any];

    const OldBook = makeFreshModel(freshAdapter(), { id: "integer", name: "string" });
    OldBook.validatesUniqueness("name");
    OldBook.encrypts("name", { deterministic: true, downcase: false });
    new OldBook();

    await OldBook.create({ name: "dune" });
    // The previous scheme has downcase:true, so "DUNE" should collide with "dune".
    const dup = await OldBook.create({ name: "DUNE" });
    expect(dup.errors.count).toBeGreaterThan(0);
  });

  it("uniqueness validation does not revalidate the attribute with current encryption type", async () => {
    const Book = makeEncryptedBookWithDowncaseName(freshAdapter());
    Book.validatesUniqueness("name");
    new Book();

    await Book.create({ name: "dune" });
    const dup = await Book.create({ name: "dune" });
    expect(dup.errors.count).toBe(1);
  });
});
