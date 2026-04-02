/**
 * Filesystem adapter — mirrors the Rails adapter pattern.
 *
 * Register adapters by name, configure via ActiveSupport.fsAdapter:
 *
 *   ActiveSupport.fsAdapter = "node";     // default in Node (auto-detected)
 *   ActiveSupport.fsAdapter = "vfs";      // browser, after registerFsAdapter("vfs", ...)
 */

export interface FsAdapter {
  readFileSync(path: string, encoding: "utf-8"): string;
  writeFileSync(path: string, content: string, options?: { mode?: number }): void;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  appendFileSync(path: string, content: string): void;
  unlinkSync(path: string): void;
  readdirSync(path: string): string[];
  rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
}

export interface PathAdapter {
  join(...parts: string[]): string;
  dirname(p: string): string;
  basename(p: string): string;
  resolve(...parts: string[]): string;
  extname(p: string): string;
}

interface FsRegistration {
  fs: FsAdapter;
  path: PathAdapter;
}

const registry = new Map<string, FsRegistration>();
let currentAdapterName: string | null = null;
let resolved: FsRegistration | null = null;

export function registerFsAdapter(name: string, fs: FsAdapter, path: PathAdapter): void {
  registry.set(name, { fs, path });
  if (name === currentAdapterName) resolved = null;
}

// Auto-register "node" at module load time if we're in Node
try {
  if (typeof globalThis.process !== "undefined" && globalThis.process.versions?.node) {
    const nodeModule = await import("node:module");
    const req = nodeModule.createRequire(import.meta.url);
    registerFsAdapter("node", req("node:fs"), req("node:path"));
  }
} catch {
  // Not in Node or node:fs unavailable — browser environment
}

function resolve(): FsRegistration {
  if (resolved) return resolved;

  const name = currentAdapterName;
  if (name) {
    const reg = registry.get(name);
    if (!reg) throw new Error(`Filesystem adapter "${name}" is not registered.`);
    resolved = reg;
    return reg;
  }

  // Default: use "node" if registered
  const nodeReg = registry.get("node");
  if (nodeReg) {
    resolved = nodeReg;
    return nodeReg;
  }

  throw new Error(
    'No filesystem adapter configured. Set ActiveSupport.fsAdapter = "node" or register a custom adapter.',
  );
}

export function getFs(): FsAdapter {
  return resolve().fs;
}

export function getPath(): PathAdapter {
  return resolve().path;
}

export const fsAdapterConfig = {
  get adapter(): string | null {
    return currentAdapterName;
  },
  set adapter(name: string | null) {
    currentAdapterName = name;
    resolved = null;
  },
};
