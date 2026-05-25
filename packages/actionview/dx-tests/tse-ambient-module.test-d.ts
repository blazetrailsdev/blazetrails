/**
 * Type-level test: importing a .tse file typechecks via the ambient
 * `declare module "*.tse"` even when no generated .tse.d.ts exists.
 */
import { describe, it, expectTypeOf } from "vitest";
import render from "./fixtures/show.html.tse";

describe("ambient declare module '*.tse' (Story 5.10)", () => {
  it("default export is a function", () => {
    expectTypeOf(render).toBeFunction();
  });

  it("accepts (context, locals) arguments", () => {
    expectTypeOf(render).toBeCallableWith({}, { name: "world" });
  });

  it("return type is unknown (ambient fallback)", () => {
    expectTypeOf(render({}, {})).toBeUnknown();
  });
});
