/**
 * Crypto adapter — abstracts node:crypto so packages can work in
 * both Node and browser environments.
 *
 * Default: Node crypto (loaded lazily). Call `setCryptoAdapter()`
 * to provide a browser-safe implementation (e.g., WebCrypto-backed).
 */

export interface CryptoAdapter {
  randomBytes(size: number): Uint8Array;
  createHash(algorithm: string): HashAdapter;
  createHmac(algorithm: string, key: string | Uint8Array): HmacAdapter;
  pbkdf2Sync(
    password: string | Uint8Array,
    salt: string | Uint8Array,
    iterations: number,
    keylen: number,
    digest: string,
  ): Uint8Array;
  timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}

export interface HashAdapter {
  update(data: string | Uint8Array): HashAdapter;
  digest(encoding: "hex" | "base64"): string;
}

export interface HmacAdapter {
  update(data: string | Uint8Array): HmacAdapter;
  digest(encoding: "hex" | "base64"): string;
}

let _crypto: CryptoAdapter | null = null;
let _cryptoPromise: Promise<CryptoAdapter> | null = null;

function wrapNodeCrypto(nodeCrypto: typeof import("node:crypto")): CryptoAdapter {
  return {
    randomBytes(size: number): Uint8Array {
      return new Uint8Array(nodeCrypto.randomBytes(size));
    },
    createHash(algorithm: string): HashAdapter {
      return nodeCrypto.createHash(algorithm);
    },
    createHmac(algorithm: string, key: string | Uint8Array): HmacAdapter {
      return nodeCrypto.createHmac(algorithm, key);
    },
    pbkdf2Sync(password, salt, iterations, keylen, digest): Uint8Array {
      return new Uint8Array(nodeCrypto.pbkdf2Sync(password, salt, iterations, keylen, digest));
    },
    timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
      return nodeCrypto.timingSafeEqual(a, b);
    },
  };
}

async function loadNodeCrypto(): Promise<CryptoAdapter> {
  const nodeCrypto = await import("node:crypto");
  return wrapNodeCrypto(nodeCrypto);
}

export function setCryptoAdapter(adapter: CryptoAdapter): void {
  _crypto = adapter;
  _cryptoPromise = null;
}

function tryLoadNode(): boolean {
  if (_crypto) return true;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const nodeCrypto = require("node:crypto") as typeof import("node:crypto");
    /* eslint-enable @typescript-eslint/no-require-imports */
    _crypto = wrapNodeCrypto(nodeCrypto);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the crypto adapter synchronously. In Node, auto-loads node:crypto.
 * In browser, setCryptoAdapter() must be called first.
 */
export function getCrypto(): CryptoAdapter {
  if (_crypto) return _crypto;
  if (tryLoadNode()) return _crypto!;
  throw new Error(
    "Crypto adapter not available. " +
      "In Node this auto-loads; in browser, call setCryptoAdapter() first.",
  );
}

/**
 * Get the crypto adapter asynchronously. Uses dynamic import for
 * environments that don't support require (ESM-only).
 */
export async function getCryptoAsync(): Promise<CryptoAdapter> {
  if (_crypto) return _crypto;
  if (tryLoadNode()) return _crypto!;
  if (!_cryptoPromise) _cryptoPromise = loadNodeCrypto().then((c) => (_crypto = c));
  return _cryptoPromise;
}
