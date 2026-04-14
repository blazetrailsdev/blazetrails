/**
 * OS adapter — mirrors the Rails adapter pattern.
 *
 * Exposes the few `node:os` surfaces higher-level packages need (currently
 * just `tmpdir`) so they can avoid importing `node:os` directly.
 */

export interface OsAdapter {
  tmpdir(): string;
}

const registry = new Map<string, OsAdapter>();
let currentAdapterName: string | null = null;
let resolved: OsAdapter | null = null;

export function registerOsAdapter(name: string, adapter: OsAdapter): void {
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
    const os = req("node:os") as { tmpdir: () => string };
    registry.set("node", { tmpdir: () => os.tmpdir() });
    return true;
  } catch {
    return false;
  }
}

function resolve(): OsAdapter {
  if (resolved) return resolved;
  const name = currentAdapterName;
  if (name) {
    const reg = registry.get(name);
    if (!reg) throw new Error(`OS adapter "${name}" is not registered.`);
    resolved = reg;
    return reg;
  }
  if (tryAutoRegisterNode()) {
    resolved = registry.get("node")!;
    return resolved;
  }
  throw new Error(
    "No OS adapter configured. Set ActiveSupport.osAdapter or register a custom adapter.",
  );
}

export function getOs(): OsAdapter {
  return resolve();
}

export const osAdapterConfig = {
  get adapter(): string | null {
    return currentAdapterName;
  },
  set adapter(name: string | null) {
    currentAdapterName = name;
    resolved = null;
  },
};
