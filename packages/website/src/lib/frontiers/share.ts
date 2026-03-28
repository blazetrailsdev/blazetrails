import { compressSync, decompressSync } from "fflate";

/**
 * Client for the Frontiers share API.
 *
 * Supports two modes:
 *   1. Backend API — POST/GET to a server that stores DB snapshots.
 *   2. URL hash — compress DB into the URL fragment (no backend needed, size-limited).
 *
 * The backend URL is configurable. If not set, falls back to URL hash mode.
 */

let _apiBase: string | null = null;

export function setApiBase(url: string | null) {
  _apiBase = url;
}

export function getApiBase(): string | null {
  return _apiBase;
}

export interface ShareResult {
  id: string;
  url: string;
  mode: "api" | "hash";
  size: number;
}

// --- Backend API mode ---

async function apiSave(dbBytes: Uint8Array, name: string): Promise<ShareResult> {
  const compressed = compressSync(dbBytes);
  const body = new Blob([compressed], { type: "application/octet-stream" });

  const res = await fetch(`${_apiBase}/api/projects`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-project-name": name,
    },
    body,
  });

  if (!res.ok) throw new Error(`Save failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return {
    id: data.id,
    url: `${location.origin}/frontiers?project=${data.id}`,
    mode: "api",
    size: compressed.length,
  };
}

async function apiLoad(id: string): Promise<{ data: Uint8Array; name: string } | null> {
  const res = await fetch(`${_apiBase}/api/projects/${id}`);
  if (!res.ok) return null;
  const name = res.headers.get("x-project-name") ?? "untitled";
  const compressed = new Uint8Array(await res.arrayBuffer());
  const data = decompressSync(compressed);
  return { data, name };
}

// --- URL hash mode ---

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hashSave(dbBytes: Uint8Array, name: string): ShareResult {
  const compressed = compressSync(dbBytes);
  const encoded = toBase64Url(compressed);

  // Encode name into the hash as well: name:data
  const nameEncoded = encodeURIComponent(name);
  const hash = `${nameEncoded}:${encoded}`;

  const url = `${location.origin}/frontiers#${hash}`;

  if (url.length > 100_000) {
    throw new Error(
      `Project too large for URL sharing (${(url.length / 1024).toFixed(0)}KB). Use backend API instead.`,
    );
  }

  return {
    id: hash.slice(0, 8),
    url,
    mode: "hash",
    size: compressed.length,
  };
}

function hashLoad(): { data: Uint8Array; name: string } | null {
  const hash = location.hash.slice(1);
  if (!hash) return null;

  const colonIdx = hash.indexOf(":");
  if (colonIdx === -1) return null;

  const name = decodeURIComponent(hash.slice(0, colonIdx));
  const encoded = hash.slice(colonIdx + 1);
  try {
    const compressed = fromBase64Url(encoded);
    const data = decompressSync(compressed);
    return { data, name };
  } catch {
    return null;
  }
}

// --- Public API ---

/**
 * Save a project and get a shareable link.
 * Uses backend API if configured, otherwise URL hash.
 */
export async function shareProject(dbBytes: Uint8Array, name: string): Promise<ShareResult> {
  if (_apiBase) {
    return apiSave(dbBytes, name);
  }
  return hashSave(dbBytes, name);
}

/**
 * Load a shared project.
 * Checks URL hash first, then query param `?project=ID` for API mode.
 */
export async function loadSharedProject(): Promise<{
  data: Uint8Array;
  name: string;
} | null> {
  // Check URL hash first
  const fromHash = hashLoad();
  if (fromHash) return fromHash;

  // Check query param for API mode
  if (_apiBase) {
    const params = new URLSearchParams(location.search);
    const id = params.get("project");
    if (id) return apiLoad(id);
  }

  return null;
}

/**
 * Copy text to clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
