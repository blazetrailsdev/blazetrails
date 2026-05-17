import { describe, it, expect } from "vitest";
import {
  _routes,
  _routesStatic,
  filterActionMethodsForRoutes,
  type RouteSetLike,
} from "./url-for.js";

describe("AbstractController::UrlFor", () => {
  describe("instance _routes() stub", () => {
    it("raises with the Rails-shaped hint until the host overrides it", () => {
      expect(() => _routes.call({})).toThrow(/include routing helpers explicitly/);
    });
  });

  describe("static _routesStatic()", () => {
    it("returns null by default", () => {
      expect(_routesStatic()).toBeNull();
    });
  });

  describe("filterActionMethodsForRoutes()", () => {
    it("returns the unfiltered list when no route set is wired up", () => {
      expect(filterActionMethodsForRoutes(["show", "index"], null)).toEqual(["show", "index"]);
    });

    it("removes any action name that collides with a route helper name", () => {
      const routes: RouteSetLike = {
        namedRoutes: { helperNames: ["postsUrl", "postPath", "show"] },
      };
      expect(filterActionMethodsForRoutes(["show", "index", "edit"], routes)).toEqual([
        "index",
        "edit",
      ]);
    });

    it("returns a defensive copy so callers can't mutate the source", () => {
      const original = ["a", "b"];
      const filtered = filterActionMethodsForRoutes(original, null);
      filtered.push("evil");
      expect(original).toEqual(["a", "b"]);
    });
  });
});
