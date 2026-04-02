/**
 * Crypto adapter — mirrors the Rails adapter pattern.
 *
 * Register adapters by name, configure via ActiveSupport.cryptoAdapter:
 *
 *   ActiveSupport.cryptoAdapter = "node";       // default in Node (auto-detected)
 *   ActiveSupport.cryptoAdapter = "webcrypto";   // browser, after registerCryptoAdapter(...)
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

const registry = new Map<string, CryptoAdapter>();
let currentAdapterName: string | null = null;
let resolved: CryptoAdapter | null = null;

export function registerCryptoAdapter(name: string, adapter: CryptoAdapter): void {
  registry.set(name, adapter);
  if (name === currentAdapterName) resolved = null;
}

// Auto-register "node" at module load time if we're in Node
try {
  if (typeof globalThis.process !== "undefined" && globalThis.process.versions?.node) {
    const nodeModule = await import("node:module");
    const req = nodeModule.createRequire(import.meta.url);
    const nodeCrypto = req("node:crypto") as typeof import("node:crypto");
    registerCryptoAdapter("node", wrapNodeCrypto(nodeCrypto));
  }
} catch {
  // Not in Node — browser environment
}

function resolve(): CryptoAdapter {
  if (resolved) return resolved;

  const name = currentAdapterName;
  if (name) {
    const reg = registry.get(name);
    if (!reg) throw new Error(`Crypto adapter "${name}" is not registered.`);
    resolved = reg;
    return reg;
  }

  const nodeReg = registry.get("node");
  if (nodeReg) {
    resolved = nodeReg;
    return nodeReg;
  }

  throw new Error(
    'No crypto adapter configured. Set ActiveSupport.cryptoAdapter = "node" or register a custom adapter.',
  );
}

export function getCrypto(): CryptoAdapter {
  return resolve();
}

export const cryptoAdapterConfig = {
  get adapter(): string | null {
    return currentAdapterName;
  },
  set adapter(name: string | null) {
    currentAdapterName = name;
    resolved = null;
  },
};
