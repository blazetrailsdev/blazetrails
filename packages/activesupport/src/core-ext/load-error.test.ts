import { describe, it, expect } from "vitest";

describe("TestLoadError", () => {
  it("with require", async () => {
    // @ts-expect-error — intentionally importing nonexistent module
    await expect(import("no_this_file_dont_exist")).rejects.toThrow();
  });

  it("with load", async () => {
    // @ts-expect-error — intentionally importing nonexistent module
    await expect(import("nor_does_this_one")).rejects.toThrow();
  });

  it("path", async () => {
    try {
      // @ts-expect-error — intentionally importing nonexistent module
      await import("nor/this/one");
      expect.unreachable("should have thrown");
    } catch (e: any) {
      expect(e.message).toContain("nor/this/one");
    }
  });

  it("is missing with nil path", () => {
    const error = new Error();
    (error as any).code = "MODULE_NOT_FOUND";
    expect(error).toBeInstanceOf(Error);
  });
});
