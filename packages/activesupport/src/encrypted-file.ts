/**
 * EncryptedFile — port of `ActiveSupport::EncryptedFile`.
 *
 * Reads / writes a file whose contents are encrypted with a key sourced from
 * either an env var (`envKey`) or a key file on disk (`keyPath`). The
 * underlying cipher comes from {@link MessageEncryptor}.
 *
 * Divergences from Rails (intentional, documented):
 *
 * - **Async API.** All I/O methods return promises; trailties' "async fs
 *   only" rule (and browser hosts without sync fs) forbids the sync surface
 *   Rails uses.
 * - **Default cipher = `aes-256-cbc`.** Rails uses `aes-128-gcm`, but our
 *   `MessageEncryptor` does not currently support GCM auth tags. Greenfield
 *   ports have no on-disk Rails files to read, so the cipher choice is
 *   free; revisit if/when GCM lands.
 * - **Default serializer = identity (string in, string out).** Rails uses
 *   `Marshal`. Higher layers ({@link EncryptedConfiguration}) parse the
 *   string themselves.
 * - **Env lookup goes through `processAdapter.env`**, not `process.env`.
 */

import { getFsAsync, getPathAsync } from "./fs-adapter.js";
import { MessageEncryptor, NullSerializer } from "./message-encryptor.js";
import { env as processEnv } from "./process-adapter.js";

const CIPHER = "aes-256-cbc";
const KEY_BYTES = 32;

export class MissingContentError extends Error {
  constructor(contentPath: string) {
    super(`Missing encrypted content file in ${contentPath}.`);
    this.name = "MissingContentError";
  }
}

export class MissingKeyError extends Error {
  constructor(opts: { keyPath: string; envKey: string }) {
    super(
      `Missing encryption key to decrypt file with. ` +
        `Ask your team for your master key and write it to ${opts.keyPath} ` +
        `or put it in the ENV['${opts.envKey}'].`,
    );
    this.name = "MissingKeyError";
  }
}

export class InvalidKeyLengthError extends Error {
  constructor() {
    super(`Encryption key must be exactly ${EncryptedFile.expectedKeyLength()} characters.`);
    this.name = "InvalidKeyLengthError";
  }
}

export interface EncryptedFileOptions {
  contentPath: string;
  keyPath: string;
  envKey: string;
  raiseIfMissingKey: boolean;
}

export class EncryptedFile {
  readonly contentPath: string;
  readonly keyPath: string;
  readonly envKey: string;
  readonly raiseIfMissingKey: boolean;

  private keyFileContents: string | null = null;
  private keyFileChecked = false;

  constructor(opts: EncryptedFileOptions) {
    this.contentPath = opts.contentPath;
    this.keyPath = opts.keyPath;
    this.envKey = opts.envKey;
    this.raiseIfMissingKey = opts.raiseIfMissingKey;
  }

  static generateKey(): string {
    const bytes = new Uint8Array(KEY_BYTES);
    for (let i = 0; i < KEY_BYTES; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  static expectedKeyLength(): number {
    return KEY_BYTES * 2;
  }

  async key(): Promise<string | null> {
    const envValue = this.readEnvKey();
    if (envValue) return envValue;
    const fileValue = await this.readKeyFile();
    if (fileValue) return fileValue;
    if (this.raiseIfMissingKey) {
      throw new MissingKeyError({ keyPath: this.keyPath, envKey: this.envKey });
    }
    return null;
  }

  async hasKey(): Promise<boolean> {
    if (this.readEnvKey()) return true;
    return (await this.readKeyFile()) !== null;
  }

  async read(): Promise<string> {
    const key = await this.key();
    const fs = await getFsAsync();
    if (key !== null && (await fs.exists!(this.contentPath))) {
      const raw = (await fs.readFile!(this.contentPath, "utf8")).trim();
      return this.decrypt(key, raw);
    }
    throw new MissingContentError(this.contentPath);
  }

  async write(contents: string): Promise<void> {
    const key = await this.key();
    if (key === null) {
      throw new MissingKeyError({ keyPath: this.keyPath, envKey: this.envKey });
    }
    const fs = await getFsAsync();
    const tmp = `${this.contentPath}.tmp`;
    await fs.writeFile!(tmp, this.encrypt(key, contents), { mode: 0o600 });
    await fs.rename!(tmp, this.contentPath);
  }

  async change(block: (tmpPath: string) => void | Promise<void>): Promise<void> {
    const contents = await this.readOrEmpty();
    const fs = await getFsAsync();
    const path = await getPathAsync();
    const base = path.basename(this.contentPath).replace(/\.enc$/, "");
    const dir = await fs.mkdtemp!(`${path.dirname(this.contentPath)}${path.sep}encfile-`);
    const tmpPath = path.join(dir, base);
    try {
      await fs.writeFile!(tmpPath, contents);
      await block(tmpPath);
      const updated = await fs.readFile!(tmpPath, "utf8");
      if (updated !== contents) await this.write(updated);
    } finally {
      try {
        await fs.unlink!(tmpPath);
      } catch {
        /* tmp already gone */
      }
    }
  }

  private async readOrEmpty(): Promise<string> {
    try {
      return await this.read();
    } catch (e) {
      if (e instanceof MissingContentError) return "";
      throw e;
    }
  }

  private readEnvKey(): string | null {
    const v = processEnv[this.envKey];
    return v && v.length > 0 ? v : null;
  }

  private async readKeyFile(): Promise<string | null> {
    if (this.keyFileChecked) return this.keyFileContents;
    this.keyFileChecked = true;
    const fs = await getFsAsync();
    if (!(await fs.exists!(this.keyPath))) return null;
    this.keyFileContents = (await fs.readFile!(this.keyPath, "utf8")).trim();
    return this.keyFileContents;
  }

  private encryptor(key: string): MessageEncryptor {
    this.checkKeyLength(key);
    return new MessageEncryptor(Buffer.from(key, "hex"), {
      cipher: CIPHER,
      serializer: NullSerializer,
    });
  }

  private encrypt(key: string, plaintext: string): string {
    return this.encryptor(key).encryptAndSign(plaintext);
  }

  private decrypt(key: string, ciphertext: string): string {
    return this.encryptor(key).decryptAndVerify(ciphertext) as string;
  }

  private checkKeyLength(key: string): void {
    if (key.length !== EncryptedFile.expectedKeyLength()) {
      throw new InvalidKeyLengthError();
    }
  }
}
