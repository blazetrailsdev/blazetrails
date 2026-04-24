/**
 * Encryption configuration.
 *
 * Mirrors: ActiveRecord::Encryption::Config
 */

import { ConfigError } from "./errors.js";
import type { SchemeOptions } from "./scheme.js";
import { KeyGenerator } from "./key-generator.js";
import { DerivedSecretKeyProvider } from "./derived-secret-key-provider.js";

export class Config {
  primaryKey?: string | string[];
  deterministicKey?: string;
  keyDerivationSalt?: string;
  storeKeyReferences: boolean = false;
  supportUnencryptedData: boolean = false;
  encryptFixtures: boolean = false;
  validateColumnSize: boolean = true;
  addToFilterParameters: boolean = true;
  excludeFromFilterParameters: string[] = [];
  previousSchemes: SchemeOptions[] = [];
  extendQueries: boolean = false;
  hashDigestClass: string = "SHA1";
  keyProviderClass?: string;
  compressor: Compressor = defaultCompressor;
  forcedEncodingForDeterministicEncryption: string = "UTF-8";

  private _requiredKeys: Set<string> = new Set([
    "primaryKey",
    "deterministicKey",
    "keyDerivationSalt",
  ]);

  constructor() {}

  get excludedFromFilterParameters(): string[] {
    return this.excludeFromFilterParameters;
  }

  set previous(schemes: SchemeOptions[]) {
    for (const props of schemes) {
      this.previousSchemes.push(props);
    }
  }

  set supportSha1ForNonDeterministicEncryption(value: boolean) {
    if (value && this.primaryKey) {
      const sha1KeyGenerator = new KeyGenerator("SHA1");
      const sha1KeyProvider = new DerivedSecretKeyProvider(this.primaryKey, {
        keyGenerator: sha1KeyGenerator,
      });
      this.previousSchemes.push({ keyProvider: sha1KeyProvider });
    }
  }

  get(key: string): unknown {
    const value = (this as any)[key];
    if (value === undefined && this._requiredKeys.has(key)) {
      throw new ConfigError(
        `Missing encryption key: ${key}. Please set ActiveRecord::Encryption.config.${key}`,
      );
    }
    return value;
  }
}

export interface Compressor {
  deflate(data: string): Buffer | Uint8Array;
  inflate(data: Buffer | Uint8Array): string;
}

import { deflateSync, inflateSync } from "zlib";

export const defaultCompressor: Compressor = {
  deflate(data: string): Buffer {
    return deflateSync(Buffer.from(data, "utf-8"));
  },
  inflate(data: Buffer | Uint8Array): string {
    return inflateSync(data).toString("utf-8");
  },
};
