/**
 * Child-process adapter — mirrors the Rails adapter pattern.
 *
 * Exposes a minimal synchronous `spawnSync`-like API so higher-level packages
 * (activerecord tasks, trailties CLI) can shell out to external tools without
 * taking a direct dependency on `node:child_process`.
 */

export interface SpawnSyncOptions {
  input?: string | Uint8Array;
  env?: NodeJS.ProcessEnv;
  encoding?: "utf8" | "utf-8" | null;
  cwd?: string;
}

export interface SpawnSyncResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface ChildProcessAdapter {
  spawnSync(cmd: string, args: string[], options?: SpawnSyncOptions): SpawnSyncResult;
}

const registry = new Map<string, ChildProcessAdapter>();
let currentAdapterName: string | null = null;
let resolved: ChildProcessAdapter | null = null;

export function registerChildProcessAdapter(name: string, adapter: ChildProcessAdapter): void {
  registry.set(name, adapter);
  if (name === currentAdapterName) resolved = null;
}

let nodeAttempted = false;

function tryAutoRegisterNode(): boolean {
  if (registry.has("node")) return true;
  if (nodeAttempted) return false;
  nodeAttempted = true;
  try {
    if (typeof globalThis.process === "undefined" || !globalThis.process.versions?.node) {
      return false;
    }
    const nodeModule =
      typeof require !== "undefined"
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("node:module")
        : null;
    if (!nodeModule) return false;
    const req = nodeModule.createRequire(
      typeof __filename !== "undefined" ? __filename : "file:///activesupport",
    );
    const cp = req("node:child_process") as {
      spawnSync: (cmd: string, args: string[], opts?: unknown) => SpawnSyncResult;
    };
    registry.set("node", {
      spawnSync(cmd, args, options) {
        const result = cp.spawnSync(cmd, args, {
          input: options?.input,
          env: options?.env,
          encoding: options?.encoding ?? "utf8",
          cwd: options?.cwd,
        });
        return {
          status: result.status,
          signal: result.signal,
          stdout: typeof result.stdout === "string" ? result.stdout : String(result.stdout ?? ""),
          stderr: typeof result.stderr === "string" ? result.stderr : String(result.stderr ?? ""),
          error: result.error,
        };
      },
    });
    return true;
  } catch {
    return false;
  }
}

function resolve(): ChildProcessAdapter {
  if (resolved) return resolved;
  const name = currentAdapterName;
  if (name) {
    const reg = registry.get(name);
    if (!reg) throw new Error(`Child-process adapter "${name}" is not registered.`);
    resolved = reg;
    return reg;
  }
  if (tryAutoRegisterNode()) {
    resolved = registry.get("node")!;
    return resolved;
  }
  throw new Error(
    "No child-process adapter configured. Set ActiveSupport.childProcessAdapter or register a custom adapter.",
  );
}

export function getChildProcess(): ChildProcessAdapter {
  return resolve();
}

export const childProcessAdapterConfig = {
  get adapter(): string | null {
    return currentAdapterName;
  },
  set adapter(name: string | null) {
    currentAdapterName = name;
    resolved = null;
  },
};
