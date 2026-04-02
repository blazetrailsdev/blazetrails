/**
 * Filesystem adapter — abstracts node:fs and node:path so packages
 * can work in both Node and browser environments.
 *
 * Default: Node fs/path (loaded lazily so the import doesn't break
 * browser bundles). Call `setFsAdapter()` to provide a browser-safe
 * implementation (e.g., VirtualFS-backed).
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

let _fs: FsAdapter | null = null;
let _path: PathAdapter | null = null;

export function setFsAdapter(fs: FsAdapter, path: PathAdapter): void {
  _fs = fs;
  _path = path;
}

function tryLoadNode(): boolean {
  if (_fs && _path) return true;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    _fs = require("node:fs") as FsAdapter;
    _path = require("node:path") as PathAdapter;
    /* eslint-enable @typescript-eslint/no-require-imports */
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the filesystem adapter. In Node environments, auto-loads
 * node:fs synchronously. In browser, setFsAdapter() must be called first.
 */
export function getFs(): FsAdapter {
  if (_fs) return _fs;
  if (tryLoadNode()) return _fs!;
  throw new Error(
    "Filesystem adapter not available. " +
      "In Node this auto-loads; in browser, call setFsAdapter() first.",
  );
}

/**
 * Get the path adapter. In Node environments, auto-loads
 * node:path synchronously. In browser, setFsAdapter() must be called first.
 */
export function getPath(): PathAdapter {
  if (_path) return _path;
  if (tryLoadNode()) return _path!;
  throw new Error(
    "Path adapter not available. " +
      "In Node this auto-loads; in browser, call setFsAdapter() first.",
  );
}
