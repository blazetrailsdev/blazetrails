import { describe, it, expect } from "vitest";
import { Route } from "./route.js";

describe("Route", () => {
  describe("pathConstraints / requestConstraints", () => {
    it("splits constraints by whether the key is a path capture", () => {
      const route = new Route("GET", "/posts/:id", "posts", "show", {
        constraints: {
          id: /\d+/,
          subdomain: /^api$/,
          format: "json",
        },
      });
      expect(route.pathConstraints).toEqual({ id: /\d+/ });
      expect(route.requestConstraints).toEqual({
        subdomain: /^api$/,
        format: "json",
      });
    });

    it("treats glob (*name) segments as path captures", () => {
      const route = new Route("GET", "/assets/*path", "assets", "show", {
        constraints: { path: /.+/, format: "json" },
      });
      expect(route.pathConstraints).toEqual({ path: /.+/ });
      expect(route.requestConstraints).toEqual({ format: "json" });
    });

    it("returns empty maps when no constraints are declared", () => {
      const route = new Route("GET", "/posts/:id", "posts", "show");
      expect(route.pathConstraints).toEqual({});
      expect(route.requestConstraints).toEqual({});
    });
  });

  describe("pathParamNames", () => {
    it("lists dynamic and glob captures in declaration order", () => {
      const route = new Route("GET", "/a/:id/b/*rest", "x", "y");
      expect(route.pathParamNames).toEqual(["id", "rest"]);
    });
  });
});
