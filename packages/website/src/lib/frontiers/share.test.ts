import { describe, it, expect } from "vitest";
import { compressSync, decompressSync } from "fflate";

// --- Base64url encoding helpers (re-implemented for testing) ---

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

describe("base64url encoding", () => {
  it("round-trips binary data", () => {
    const data = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
    expect(fromBase64Url(toBase64Url(data))).toEqual(data);
  });

  it("produces URL-safe characters only", () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;
    const encoded = toBase64Url(data);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    expect(/^[A-Za-z0-9_-]+$/.test(encoded)).toBe(true);
  });

  it("handles empty input", () => {
    expect(fromBase64Url(toBase64Url(new Uint8Array(0)))).toEqual(new Uint8Array(0));
  });

  it("handles single byte", () => {
    const data = new Uint8Array([42]);
    expect(fromBase64Url(toBase64Url(data))).toEqual(data);
  });

  it("handles large payloads", () => {
    const data = new Uint8Array(100000);
    for (let i = 0; i < data.length; i++) data[i] = i % 256;
    expect(fromBase64Url(toBase64Url(data))).toEqual(data);
  });
});

describe("compression round-trip", () => {
  it("compresses and decompresses", () => {
    const payload = new Uint8Array(1024);
    const header = new TextEncoder().encode("SQLite format 3\0");
    payload.set(header);
    const compressed = compressSync(payload);
    expect(decompressSync(compressed)).toEqual(payload);
    expect(compressed.length).toBeLessThan(payload.length);
  });

  it("handles small payloads", () => {
    const data = new Uint8Array([1, 2, 3]);
    const compressed = compressSync(data);
    expect(decompressSync(compressed)).toEqual(data);
  });

  it("handles incompressible data", () => {
    // Random-like data compresses poorly but should still round-trip
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = (i * 97 + 13) % 256;
    const compressed = compressSync(data);
    expect(decompressSync(compressed)).toEqual(data);
  });
});

describe("full share encoding pipeline", () => {
  it("compress -> base64url -> decode -> decompress round-trips", () => {
    const dbBytes = new Uint8Array(500);
    for (let i = 0; i < 500; i++) dbBytes[i] = i % 256;

    const compressed = compressSync(dbBytes);
    const encoded = toBase64Url(compressed);
    const decoded = fromBase64Url(encoded);
    const restored = decompressSync(decoded);

    expect(restored).toEqual(dbBytes);
  });

  it("produces a URL-safe string under 100KB for a small DB", () => {
    const dbBytes = new Uint8Array(50000);
    dbBytes.fill(0);
    const compressed = compressSync(dbBytes);
    const encoded = toBase64Url(compressed);
    // 50KB of zeros should compress very well
    expect(encoded.length).toBeLessThan(1000);
  });

  it("hash format: name:data parses correctly", () => {
    const name = "my-project";
    const dbBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const compressed = compressSync(dbBytes);
    const encoded = toBase64Url(compressed);
    const hash = `${encodeURIComponent(name)}:${encoded}`;

    // Parse it back
    const colonIdx = hash.indexOf(":");
    const parsedName = decodeURIComponent(hash.slice(0, colonIdx));
    const parsedData = decompressSync(fromBase64Url(hash.slice(colonIdx + 1)));

    expect(parsedName).toBe(name);
    expect(parsedData).toEqual(dbBytes);
  });

  it("handles project names with special characters", () => {
    const name = "my project (v2) / test";
    const encoded = encodeURIComponent(name);
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toBe(name);
  });
});
