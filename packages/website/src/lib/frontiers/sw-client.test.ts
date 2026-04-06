import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SwRequest, SwResponse, SwBroadcast } from "./sw-protocol.js";
import { SwVfsProxy } from "./sw-vfs-proxy.js";
import { SwAdapterProxy } from "./sw-adapter-proxy.js";
import type { SwClient } from "./sw-client.js";

/**
 * Mock SwClient that resolves responses via a handler function.
 * Simulates the postMessage/MessageChannel pattern without a real SW.
 */
function createMockSwClient(
  handler: (req: SwRequest) => SwResponse,
): SwClient & { broadcast: (msg: SwBroadcast) => void } {
  const broadcastListeners: Array<(msg: SwBroadcast) => void> = [];

  return {
    ready: true,

    async send<T extends SwResponse>(request: SwRequest): Promise<T> {
      const response = handler(request);
      if (response.type === "error") {
        throw new Error((response as { type: "error"; message: string }).message);
      }
      return response as T;
    },

    onBroadcast(fn: (msg: SwBroadcast) => void): () => void {
      broadcastListeners.push(fn);
      return () => {
        const idx = broadcastListeners.indexOf(fn);
        if (idx >= 0) broadcastListeners.splice(idx, 1);
      };
    },

    async destroy() {},

    broadcast(msg: SwBroadcast) {
      for (const fn of broadcastListeners) fn(msg);
    },
  };
}

describe("SwVfsProxy", () => {
  let client: ReturnType<typeof createMockSwClient>;
  let proxy: SwVfsProxy;

  const sampleFile = {
    path: "app/models/user.ts",
    content: "export class User {}",
    language: "typescript",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };

  beforeEach(() => {
    client = createMockSwClient((req) => {
      switch (req.type) {
        case "vfs:list":
          return { type: "vfs:list", files: [sampleFile] };
        case "vfs:read":
          return {
            type: "vfs:read",
            file: (req as any).path === sampleFile.path ? sampleFile : null,
          };
        case "vfs:write":
          return { type: "vfs:write", ok: true as const };
        case "vfs:delete":
          return { type: "vfs:delete", deleted: true };
        case "vfs:rename":
          return { type: "vfs:rename", renamed: true };
        case "vfs:exists":
          return { type: "vfs:exists", exists: (req as any).path === sampleFile.path };
        default:
          return { type: "error", message: `Unknown: ${req.type}` };
      }
    });
    proxy = new SwVfsProxy(client);
  });

  afterEach(() => {
    proxy.dispose();
  });

  it("lists files", async () => {
    const files = await proxy.list();
    expect(files).toEqual([sampleFile]);
  });

  it("reads a file", async () => {
    const file = await proxy.read("app/models/user.ts");
    expect(file).toEqual(sampleFile);
  });

  it("returns null for missing file", async () => {
    const file = await proxy.read("nonexistent.ts");
    expect(file).toBeNull();
  });

  it("writes a file", async () => {
    await expect(proxy.write("foo.ts", "content")).resolves.toBeUndefined();
  });

  it("deletes a file", async () => {
    const deleted = await proxy.delete("app/models/user.ts");
    expect(deleted).toBe(true);
  });

  it("renames a file", async () => {
    const renamed = await proxy.rename("old.ts", "new.ts");
    expect(renamed).toBe(true);
  });

  it("checks existence", async () => {
    expect(await proxy.exists("app/models/user.ts")).toBe(true);
    expect(await proxy.exists("nonexistent.ts")).toBe(false);
  });

  it("fires onChange when SW broadcasts vfs:changed", () => {
    const fn = vi.fn();
    proxy.onChange(fn);

    client.broadcast({ type: "vfs:changed" });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not fire onChange for db:changed broadcasts", () => {
    const fn = vi.fn();
    proxy.onChange(fn);

    client.broadcast({ type: "db:changed" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("unsubscribes onChange", () => {
    const fn = vi.fn();
    const unsub = proxy.onChange(fn);
    unsub();

    client.broadcast({ type: "vfs:changed" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("dispose stops all listeners", () => {
    const fn = vi.fn();
    proxy.onChange(fn);
    proxy.dispose();

    client.broadcast({ type: "vfs:changed" });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("SwAdapterProxy", () => {
  let client: ReturnType<typeof createMockSwClient>;
  let proxy: SwAdapterProxy;

  beforeEach(() => {
    client = createMockSwClient((req) => {
      switch (req.type) {
        case "db:tables":
          return { type: "db:tables", tables: ["users", "posts"] };
        case "db:columns":
          return {
            type: "db:columns",
            columns: [
              { name: "id", type: "INTEGER", notnull: true, pk: true },
              { name: "name", type: "TEXT", notnull: false, pk: false },
            ],
          };
        case "db:query":
          return {
            type: "db:query",
            results: [{ columns: ["id", "name"], values: [[1, "dean"]] }],
          };
        case "exec":
          return {
            type: "exec",
            result: { success: true, output: ["Created model User"], exitCode: 0 },
          };
        case "db:export":
          return { type: "db:export", data: new Uint8Array([1, 2, 3]) };
        case "db:import":
          return { type: "db:import", ok: true as const };
        default:
          return { type: "error", message: `Unknown: ${req.type}` };
      }
    });
    proxy = new SwAdapterProxy(client);
  });

  it("gets tables", async () => {
    const tables = await proxy.getTables();
    expect(tables).toEqual(["users", "posts"]);
  });

  it("gets columns", async () => {
    const columns = await proxy.getColumns("users");
    expect(columns).toHaveLength(2);
    expect(columns[0]).toEqual({ name: "id", type: "INTEGER", notnull: true, pk: true });
  });

  it("executes raw SQL", async () => {
    const results = await proxy.execRaw('SELECT * FROM "users"');
    expect(results).toHaveLength(1);
    expect(results[0].columns).toEqual(["id", "name"]);
    expect(results[0].values).toEqual([[1, "dean"]]);
  });

  it("executes CLI commands", async () => {
    const result = await proxy.exec("generate model User name:string");
    expect(result.success).toBe(true);
    expect(result.output).toContain("Created model User");
    expect(result.exitCode).toBe(0);
  });

  it("exports database", async () => {
    const data = await proxy.exportDB();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("imports database", async () => {
    await expect(proxy.importDB(new Uint8Array([4, 5, 6]))).resolves.toBeUndefined();
  });
});

describe("SwClient error handling", () => {
  it("rejects when SW returns error response", async () => {
    const client = createMockSwClient(() => ({
      type: "error",
      message: "Something broke",
    }));

    await expect(client.send({ type: "vfs:list" })).rejects.toThrow("Something broke");
  });
});
