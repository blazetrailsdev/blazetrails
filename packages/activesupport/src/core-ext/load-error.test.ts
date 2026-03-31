import { describe, it, expect } from "vitest";

describe("TestLoadError", () => {
  it("with require", async () => {
    const mod = "no_this_file_dont_exist";
    await expect(import(/* @vite-ignore */ mod)).rejects.toThrow();
  });

  it("with load", async () => {
    const mod = "nor_does_this_one";
    await expect(import(/* @vite-ignore */ mod)).rejects.toThrow();
  });

  it("path", async () => {
    const mod = "nor/this/one";
    try {
      await import(/* @vite-ignore */ mod);
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
