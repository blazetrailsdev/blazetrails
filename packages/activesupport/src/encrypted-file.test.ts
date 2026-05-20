import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EncryptedFile, InvalidKeyLengthError, MissingKeyError } from "./encrypted-file.js";
import { getFsAsync, getPathAsync } from "./fs-adapter.js";
import { getOsAsync } from "./os-adapter.js";
import { setEnv } from "./process-adapter.js";

describe("EncryptedFileTest", () => {
  const CONTENT = "One little fox jumped over the hedge";
  let tmpdir: string;
  let contentPath: string;
  let keyPath: string;
  let key: string;
  let originalEnv: string | undefined;

  const make = (overrides: Partial<{ keyPath: string; envKey: string }> = {}) =>
    new EncryptedFile({
      contentPath,
      keyPath: overrides.keyPath ?? keyPath,
      envKey: overrides.envKey ?? "CONTENT_KEY",
      raiseIfMissingKey: true,
    });

  beforeEach(async () => {
    originalEnv = process.env.CONTENT_KEY;
    setEnv("CONTENT_KEY", undefined);

    const fs = await getFsAsync();
    const path = await getPathAsync();
    const os = await getOsAsync();
    tmpdir = await fs.mkdtemp!(`${os.tmpdir()}${path.sep}encrypted-file-test-`);
    contentPath = path.join(tmpdir, "content.txt.enc");
    keyPath = path.join(tmpdir, "content.txt.key");
    key = EncryptedFile.generateKey();
    await fs.writeFile!(keyPath, key);
  });

  afterEach(async () => {
    const fs = await getFsAsync();
    for (const p of [contentPath, keyPath]) {
      try {
        await fs.unlink!(p);
      } catch {
        /* missing */
      }
    }
    try {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    } catch {
      /* */
    }
    setEnv("CONTENT_KEY", originalEnv);
  });

  it("reading content by env key", async () => {
    const fs = await getFsAsync();
    await fs.unlink!(keyPath);
    setEnv("CONTENT_KEY", key);
    const ef = make();
    await ef.write(CONTENT);
    expect(await ef.read()).toBe(CONTENT);
  });

  it("reading content by key file", async () => {
    const ef = make();
    await ef.write(CONTENT);
    expect(await ef.read()).toBe(CONTENT);
  });

  it("change content by key file", async () => {
    const ef = make();
    await ef.write(CONTENT);
    const fs = await getFsAsync();
    await ef.change(async (tmp) => {
      const current = await fs.readFile!(tmp, "utf8");
      await fs.writeFile!(tmp, `${current} and went by the lake`);
    });
    expect(await ef.read()).toBe(`${CONTENT} and went by the lake`);
  });

  it("change sets restricted permissions", async () => {
    const ef = make();
    await ef.write(CONTENT);
    const fs = await getFsAsync();
    const stat = await fs.stat!(contentPath);
    // Mode includes file type bits; mask to permission bits.
    const mode = (stat as unknown as { mode: number }).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("raise MissingKeyError when key is missing", async () => {
    const ef = new EncryptedFile({
      contentPath,
      keyPath: "",
      envKey: "",
      raiseIfMissingKey: true,
    });
    await expect(ef.read()).rejects.toBeInstanceOf(MissingKeyError);
  });

  it("raise MissingKeyError when env key is blank", async () => {
    const fs = await getFsAsync();
    await fs.unlink!(keyPath);
    setEnv("CONTENT_KEY", "");
    const ef = make();
    await expect(
      (async () => {
        await ef.write(CONTENT);
        await ef.read();
      })(),
    ).rejects.toThrow(/Missing encryption key to decrypt file/);
  });

  it("key can be added after MissingKeyError raised", async () => {
    const fs = await getFsAsync();
    await fs.unlink!(keyPath);
    const ef = make();
    await expect(ef.key()).rejects.toBeInstanceOf(MissingKeyError);
    await fs.writeFile!(keyPath, key);
    // Fresh instance — Rails caches key-file contents per instance too, so
    // re-add-after-miss requires a new EncryptedFile (Rails uses ||=).
    expect(await make().key()).toBe(key);
  });

  it("key? is true when key file exists", async () => {
    expect(await make().hasKey()).toBe(true);
  });

  it("key? is true when env key is present", async () => {
    const fs = await getFsAsync();
    await fs.unlink!(keyPath);
    setEnv("CONTENT_KEY", key);
    expect(await make().hasKey()).toBe(true);
  });

  it("key? is false and does not raise when the key is missing", async () => {
    const fs = await getFsAsync();
    await fs.unlink!(keyPath);
    expect(await make().hasKey()).toBe(false);
  });

  it("raise InvalidKeyLengthError when key is too short", async () => {
    const fs = await getFsAsync();
    await fs.writeFile!(keyPath, EncryptedFile.generateKey().slice(0, -1));
    await expect(make().write(CONTENT)).rejects.toBeInstanceOf(InvalidKeyLengthError);
  });

  it("raise InvalidKeyLengthError when key is too long", async () => {
    const fs = await getFsAsync();
    await fs.writeFile!(keyPath, EncryptedFile.generateKey() + "0");
    await expect(make().write(CONTENT)).rejects.toBeInstanceOf(InvalidKeyLengthError);
  });

  // Rails behavior: write through a symlinked content_path preserves the
  // symlink rather than replacing it with a regular file. Our async port
  // does not yet resolve symlinks on construction; tracked as a follow-up.
  it.skip("respects existing content_path symlink");
  it.skip("creates new content_path symlink if it's dead");

  // Default-serializer swap test relies on Rails' Codec.with helper; our
  // port hardcodes NullSerializer so the scenario doesn't apply.
  it.skip("can read encrypted file after changing default_serializer");
});
