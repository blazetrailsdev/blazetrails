import { describe, it, expect, afterEach } from "vitest";
import { RequestUtils } from "./utils.js";

describe("RequestUtils", () => {
  const initialPerformDeepMunge = RequestUtils.performDeepMunge;
  afterEach(() => {
    RequestUtils.performDeepMunge = initialPerformDeepMunge;
  });

  describe("deepMunge", () => {
    it("strips null entries from arrays", () => {
      expect(RequestUtils.deepMunge([1, null, 2] as never)).toEqual([1, 2]);
    });

    it("recurses into nested arrays", () => {
      expect(RequestUtils.deepMunge({ a: { b: [null] } } as never)).toEqual({ a: { b: [] } });
    });

    it("recurses into nested hashes", () => {
      expect(RequestUtils.deepMunge({ a: { b: null } } as never)).toEqual({ a: { b: null } });
    });

    it("preserves nested hashes inside arrays after compaction", () => {
      expect(
        RequestUtils.deepMunge({ a: { b: [{ c: null }, null, { d: "1" }] } } as never),
      ).toEqual({ a: { b: [{ c: null }, { d: "1" }] } });
    });

    it("leaves string and null leaves alone", () => {
      expect(RequestUtils.deepMunge("foo")).toBe("foo");
      expect(RequestUtils.deepMunge(null)).toBe(null);
    });
  });

  describe("normalizeEncodeParams", () => {
    it("compacts arrays when performDeepMunge is true (default)", () => {
      RequestUtils.performDeepMunge = true;
      expect(RequestUtils.normalizeEncodeParams({ x: [null, "1"] } as never)).toEqual({ x: ["1"] });
    });

    it("preserves arrays when performDeepMunge is false", () => {
      RequestUtils.performDeepMunge = false;
      expect(RequestUtils.normalizeEncodeParams({ x: [null, "1"] } as never)).toEqual({
        x: [null, "1"],
      });
    });
  });

  describe("eachParamValue", () => {
    it("yields every string leaf", () => {
      const leaves = Array.from(
        RequestUtils.eachParamValue({ a: "1", b: ["2", { c: "3" }] } as never),
      );
      expect(leaves).toEqual(["1", "2", "3"]);
    });

    it("skips null and non-string scalars", () => {
      const leaves = Array.from(RequestUtils.eachParamValue({ a: null, b: ["x"] } as never));
      expect(leaves).toEqual(["x"]);
    });
  });
});
