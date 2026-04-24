/**
 * Encryption scheme — binds configuration to an encryptor instance.
 *
 * Mirrors: ActiveRecord::Encryption::Scheme
 */

import { Encryptor, type EncryptorLike } from "./encryptor.js";
import { ConfigError } from "./errors.js";
import type { Compressor } from "./config.js";
import { Configurable } from "./configurable.js";
import { withEncryptionContext } from "./context.js";
import { DerivedSecretKeyProvider } from "./derived-secret-key-provider.js";
import { DeterministicKeyProvider } from "./deterministic-key-provider.js";
import { Key } from "./key.js";

// Module-level single-entry cache for the default key provider. Avoids storing
// plaintext key material as Map keys while still sharing one derived key provider
// across all Scheme instances for the same config. A generation counter tracks
// config changes — any change to primaryKey, salt, or digestClass creates a
// new entry without retaining the old key material.
let _defaultKeyProviderEntry: { gen: number; provider: DerivedSecretKeyProvider } | undefined;
let _defaultKeyProviderGen = 0;
let _defaultKeyProviderLastPk: string | string[] | undefined;
let _defaultKeyProviderLastSalt: string | undefined;
let _defaultKeyProviderLastDigest: string | undefined;

function getOrCreateDefaultKeyProvider(
  primaryKey: string | string[],
  keyDerivationSalt: string | undefined,
  hashDigestClass: string,
): DerivedSecretKeyProvider {
  // Bump generation if any input changed, so stale entries are not reused.
  if (
    primaryKey !== _defaultKeyProviderLastPk ||
    keyDerivationSalt !== _defaultKeyProviderLastSalt ||
    hashDigestClass !== _defaultKeyProviderLastDigest
  ) {
    _defaultKeyProviderGen++;
    _defaultKeyProviderLastPk = primaryKey;
    _defaultKeyProviderLastSalt = keyDerivationSalt;
    _defaultKeyProviderLastDigest = hashDigestClass;
  }
  if (!_defaultKeyProviderEntry || _defaultKeyProviderEntry.gen !== _defaultKeyProviderGen) {
    _defaultKeyProviderEntry = {
      gen: _defaultKeyProviderGen,
      provider: new DerivedSecretKeyProvider(primaryKey),
    };
  }
  return _defaultKeyProviderEntry.provider;
}

export interface SchemeOptions {
  keyProvider?: unknown;
  key?: string;
  deterministic?: boolean;
  supportUnencryptedData?: boolean;
  downcase?: boolean;
  ignoreCase?: boolean;
  previousSchemes?: Scheme[];
  compress?: boolean;
  compressor?: Compressor;
  encryptor?: EncryptorLike;
}

export class Scheme {
  private _keyProviderParam?: unknown;
  private _cachedKeyProviderFromKey?: DerivedSecretKeyProvider;
  private _cachedDeterministicKeyProvider?: DeterministicKeyProvider;
  key?: string;
  deterministic: boolean;
  downcase: boolean;
  ignoreCase: boolean;
  previousSchemes: Scheme[];
  private _encryptor: EncryptorLike;
  // Original options as-passed — used by _toOptions() / merge() to distinguish
  // "not set" (undefined) from "explicitly set to false", mirroring Rails'
  // @context_properties + nil-defaulted ivars + to_h.compact pattern.
  private _opts: SchemeOptions;

  constructor(options: SchemeOptions = {}) {
    this._opts = { ...options };
    this._keyProviderParam = options.keyProvider;
    this.key = options.key;
    this.deterministic = options.deterministic ?? false;
    this.downcase = options.downcase ?? false;
    this.ignoreCase = options.ignoreCase ?? false;
    this.previousSchemes = options.previousSchemes ?? [];

    if (options.encryptor) {
      this._encryptor = options.encryptor;
    } else {
      this._encryptor = new Encryptor({
        compress: options.compress,
        compressor: options.compressor,
      });
    }

    this._validate();
  }

  get encryptor(): EncryptorLike {
    return this._encryptor;
  }

  get keyProvider(): unknown {
    // When an explicit encryptor is provided, key providers are irrelevant —
    // the encryptor handles encryption without needing key material from here.
    if (this._opts.encryptor !== undefined) return this._keyProviderParam ?? undefined;
    return (
      this._keyProviderParam ??
      this._keyProviderFromKey() ??
      this._deterministicKeyProvider() ??
      this._defaultKeyProvider()
    );
  }

  isSupportUnencryptedData(): boolean {
    return this._opts.supportUnencryptedData ?? Configurable.config.supportUnencryptedData;
  }

  isFixed(): boolean {
    return this.deterministic;
  }

  merge(other: Scheme): Scheme {
    return new Scheme({ ...this._toOptions(), ...other._toOptions() });
  }

  withContext<T>(fn: () => T): T {
    const { encryptor, compress, compressor } = this._opts;
    if (encryptor !== undefined || compress === false || compressor !== undefined) {
      return withEncryptionContext({ encryptor: this._encryptor }, fn);
    }
    return fn();
  }

  isCompatibleWith(other: Scheme): boolean {
    return this.deterministic === other.deterministic;
  }

  private _toOptions(): SchemeOptions {
    const o = this._opts;
    const opts: SchemeOptions = {};
    if (o.keyProvider !== undefined) opts.keyProvider = o.keyProvider;
    if (o.key !== undefined) opts.key = o.key;
    if (o.deterministic !== undefined) opts.deterministic = o.deterministic;
    if (o.downcase !== undefined) opts.downcase = o.downcase;
    if (o.ignoreCase !== undefined) opts.ignoreCase = o.ignoreCase;
    if (o.previousSchemes !== undefined) opts.previousSchemes = o.previousSchemes;
    if (o.supportUnencryptedData !== undefined)
      opts.supportUnencryptedData = o.supportUnencryptedData;
    if (o.compress !== undefined) opts.compress = o.compress;
    if (o.compressor !== undefined) opts.compressor = o.compressor;
    if (o.encryptor !== undefined) opts.encryptor = o.encryptor;
    return opts;
  }

  private _keyProviderFromKey(): DerivedSecretKeyProvider | undefined {
    if (this.key != null) {
      this._cachedKeyProviderFromKey ??= new DerivedSecretKeyProvider(this.key);
      return this._cachedKeyProviderFromKey;
    }
    return undefined;
  }

  // Mirrors Rails' Scheme#default_key_provider → ActiveRecord::Encryption.key_provider.
  // Returns the context's keyProvider if set, otherwise derives one from config.primaryKey.
  // Memoized on the primaryKey value to avoid repeated PBKDF2 calls.
  private _defaultKeyProvider(): unknown {
    const ctxKp = Configurable.keyProvider;
    if (ctxKp != null) return ctxKp;
    if (Configurable.config.primaryKey == null) return undefined;
    // Use Config.get() so accessing primaryKey raises ConfigError with the
    // specific message "Missing encryption key: primaryKey" when unset,
    // aligning with Config's required-key semantics and Rails' behavior.
    const primaryKey = Configurable.config.get("primaryKey") as string | string[];
    const { keyDerivationSalt, hashDigestClass } = Configurable.config;
    return getOrCreateDefaultKeyProvider(primaryKey, keyDerivationSalt, hashDigestClass);
  }

  private _deterministicKeyProvider(): DeterministicKeyProvider | undefined {
    if (this.deterministic) {
      const deterministicKey = Configurable.config.get("deterministicKey") as string;
      this._cachedDeterministicKeyProvider ??= new DeterministicKeyProvider(
        new Key(deterministicKey),
      );
      return this._cachedDeterministicKeyProvider;
    }
    return undefined;
  }

  private _validate(): void {
    if (this.ignoreCase && !this.deterministic) {
      throw new ConfigError("ignoreCase requires deterministic encryption");
    }
    if (this.downcase && !this.deterministic) {
      throw new ConfigError("downcase requires deterministic encryption");
    }
    if (this._keyProviderParam != null && this.key != null) {
      throw new ConfigError("key and keyProvider can't be used simultaneously");
    }
    if (this._opts.compress === false && this._opts.compressor !== undefined) {
      throw new ConfigError("compressor can't be used with compress: false");
    }
    if (this._opts.compressor !== undefined && this._opts.encryptor !== undefined) {
      throw new ConfigError("compressor can't be used with encryptor");
    }
  }
}
