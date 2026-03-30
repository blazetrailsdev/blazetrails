import { describe, it, expect } from "vitest";
import { Gzip } from "./gzip.js";
import { constants } from "node:zlib";

describe("GzipTest", () => {
  it("compress should decompress to the same value", () => {
    const original = "compress me!";
    const compressed = Gzip.compress(original);
    const decompressed = Gzip.decompress(compressed);
    expect(decompressed).toBe(original);
  });

  it("compress should return a binary string", () => {
    const compressed = Gzip.compress("compress me!");
    expect(Buffer.isBuffer(compressed)).toBe(true);
    expect(compressed.length).toBeGreaterThan(0);
  });

  it("compress should return gzipped string by compression level", () => {
    const source = "a]".repeat(100);
    const bestCompressed = Gzip.compress(source, constants.Z_BEST_COMPRESSION);
    const noCompression = Gzip.compress(source, constants.Z_NO_COMPRESSION);
    expect(bestCompressed.length).toBeLessThan(noCompression.length);
    expect(Gzip.decompress(bestCompressed)).toBe(source);
    expect(Gzip.decompress(noCompression)).toBe(source);
  });

  it("decompress checks crc", () => {
    const compressed = Gzip.compress("test");
    const corrupted = Buffer.from(compressed);
    corrupted[corrupted.length - 1] ^= 0xff;
    expect(() => Gzip.decompress(corrupted)).toThrow();
  });
});
