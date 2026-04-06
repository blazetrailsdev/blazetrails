/**
 * Shared message types for the sandbox service worker protocol.
 * Used by both sw-client.ts (main thread) and sandbox-sw.js (worker).
 */

import type { VfsFile } from "./virtual-fs.js";

// ── Request messages (main → SW) ────────────────────────────────────────

export type SwRequest =
  | { type: "init" }
  | { type: "vfs:list" }
  | { type: "vfs:read"; path: string }
  | { type: "vfs:write"; path: string; content: string; language?: string }
  | { type: "vfs:delete"; path: string }
  | { type: "vfs:rename"; oldPath: string; newPath: string }
  | { type: "vfs:exists"; path: string }
  | { type: "db:tables" }
  | { type: "db:columns"; table: string }
  | { type: "db:query"; sql: string }
  | { type: "exec"; command: string }
  | { type: "db:export" }
  | { type: "db:import"; data: Uint8Array };

// ── Response messages (SW → main) ───────────────────────────────────────

export type SwResponse =
  | { type: "init"; ready: true }
  | { type: "vfs:list"; files: VfsFile[] }
  | { type: "vfs:read"; file: VfsFile | null }
  | { type: "vfs:write"; ok: true }
  | { type: "vfs:delete"; deleted: boolean }
  | { type: "vfs:rename"; renamed: boolean }
  | { type: "vfs:exists"; exists: boolean }
  | { type: "db:tables"; tables: string[] }
  | {
      type: "db:columns";
      columns: Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
    }
  | { type: "db:query"; results: Array<{ columns: string[]; values: unknown[][] }> }
  | { type: "exec"; result: { success: boolean; output: string[]; exitCode: number } }
  | { type: "db:export"; data: Uint8Array }
  | { type: "db:import"; ok: true }
  | { type: "error"; message: string };

// ── Broadcast messages (SW → all clients) ───────────────────────────────

export type SwBroadcast = { type: "vfs:changed" } | { type: "db:changed" };
