import { describe, expect, it } from "vitest";
import { RouteSet } from "../../routing/route-set.js";
import { RoutingError } from "../../../action-controller/metal/exceptions.js";
import {
  assertGenerates,
  assertRecognizes,
  assertRouting,
  failOn,
  withRouting,
  type RoutingAssertionsHost,
} from "./routing.js";

function buildHost(): RoutingAssertionsHost {
  const routes = new RouteSet();
  routes.draw((m) => {
    m.get("/items", { to: "items#index" });
    m.post("/items", { to: "items#create" });
    m.get("/items/list/:id", { to: "items#list" });
    m.get("/items/show/:id", { to: "items#show" });
    m.match("/all", { to: "x#a", via: "all" });
  });
  return { routes };
}

const ok = (fn: () => void) => expect(fn).not.toThrow();
const bad = (fn: () => void) => expect(fn).toThrow();

describe("assertRecognizes", () => {
  const h = buildHost();
  it("matches GET, method override, captures + extras, and 'all'", () => {
    ok(() => assertRecognizes.call(h, { controller: "items", action: "index" }, "/items"));
    ok(() =>
      assertRecognizes.call(
        h,
        { controller: "items", action: "create" },
        { path: "/items", method: "post" },
      ),
    );
    ok(() =>
      assertRecognizes.call(
        h,
        { controller: "items", action: "list", id: "1", view: "print" },
        "/items/list/1",
        { view: "print" },
      ),
    );
    ok(() =>
      assertRecognizes.call(h, { controller: "x", action: "a" }, { path: "/all", method: "all" }),
    );
  });

  it("throws on mismatch or unknown route", () => {
    bad(() => assertRecognizes.call(h, { controller: "wrong", action: "x" }, "/items"));
    bad(() => assertRecognizes.call(h, { controller: "items", action: "index" }, "/nope"));
  });
});

describe("assertGenerates", () => {
  const h = buildHost();
  it("generates path, prefixes slash, surfaces extras", () => {
    ok(() => assertGenerates.call(h, "/items", { controller: "items", action: "index" }));
    ok(() => assertGenerates.call(h, "items", { controller: "items", action: "index" }));
    ok(() =>
      assertGenerates.call(
        h,
        "/items/list/1",
        { controller: "items", action: "list", id: "1", view: "print" },
        {},
        { view: "print" },
      ),
    );
  });
  it("throws on path mismatch", () => {
    bad(() => assertGenerates.call(h, "/wrong", { controller: "items", action: "index" }));
  });
});

describe("assertRouting", () => {
  it("verifies both directions", () => {
    ok(() =>
      assertRouting.call(buildHost(), "/items/show/23", {
        controller: "items",
        action: "show",
        id: "23",
      }),
    );
  });
});

describe("withRouting", () => {
  it("swaps in a fresh RouteSet and restores after the block (even on throw)", () => {
    const original = buildHost();
    const before = original.routes;
    withRouting.call(original, (routes: RouteSet) => {
      routes.draw((m) => m.get("/temp", { to: "tmp#i" }));
      expect(original.routes).toBe(routes);
      ok(() => assertRecognizes.call(original, { controller: "tmp", action: "i" }, "/temp"));
    });
    expect(original.routes).toBe(before);
    bad(() =>
      withRouting.call(original, () => {
        throw new Error("boom");
      }),
    );
    expect(original.routes).toBe(before);
  });
});

describe("failOn", () => {
  it("rethrows matching exception with the supplied message", () => {
    expect(() =>
      failOn(RoutingError, "custom msg", () => {
        throw new RoutingError("inner");
      }),
    ).toThrow("custom msg");
  });
  it("falls through unrelated errors", () => {
    expect(() =>
      failOn(RoutingError, "ignored", () => {
        throw new TypeError("other");
      }),
    ).toThrow(TypeError);
  });
});
