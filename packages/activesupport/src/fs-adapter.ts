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

async function loadNodeFs(): Promise<FsAdapter> {
  const fs = await import("node:fs");
  return fs;
}

async function loadNodePath(): Promise<PathAdapter> {
  const path = await import("node:path");
  return path;
}

let _fsPromise: Promise<FsAdapter> | null = null;
let _pathPromise: Promise<PathAdapter> | null = null;

export function setFsAdapter(fs: FsAdapter, path: PathAdapter): void {
  _fs = fs;
  _path = path;
  _fsPromise = null;
  _pathPromise = null;
}

export function getFs(): FsAdapter {
  if (_fs) return _fs;
  throw new Error(
    "Filesystem adapter not available synchronously. " +
      "Call setFsAdapter() first, or use getFsAsync().",
  );
}

export function getPath(): PathAdapter {
  if (_path) return _path;
  throw new Error(
    "Path adapter not available synchronously. " +
      "Call setFsAdapter() first, or use getPathAsync().",
  );
}

export async function getFsAsync(): Promise<FsAdapter> {
  if (_fs) return _fs;
  if (!_fsPromise) _fsPromise = loadNodeFs().then((fs) => (_fs = fs));
  return _fsPromise;
}

export async function getPathAsync(): Promise<PathAdapter> {
  if (_path) return _path;
  if (!_pathPromise) _pathPromise = loadNodePath().then((p) => (_path = p));
  return _pathPromise;
}

/**
 * Initialize the default Node.js adapters. Call this at application
 * startup in Node environments. In browser environments, call
 * setFsAdapter() with a VFS-backed implementation instead.
 */
export async function initNodeAdapters(): Promise<void> {
  await Promise.all([getFsAsync(), getPathAsync()]);
}
