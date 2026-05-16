import { describe, it, expect } from "vitest";
import { RouteSet } from "./route-set.js";

describe("RouteSet — Journey bridge", () => {
  it("journeyRecognize resolves a simple GET route", () => {
    const routes = new RouteSet();
    routes.draw((r) => {
      r.get("/posts", { to: "posts#index" });
    });
    const m = routes.journeyRecognize("GET", "/posts");
    expect(m).not.toBeNull();
    expect(m!.route.controller).toBe("posts");
    expect(m!.route.action).toBe("index");
  });

  it("journeyRecognize captures dynamic segments", () => {
    const routes = new RouteSet();
    routes.draw((r) => {
      r.get("/posts/:id", { to: "posts#show" });
    });
    const m = routes.journeyRecognize("GET", "/posts/42");
    expect(m).not.toBeNull();
    expect(m!.params["id"]).toBe("42");
    expect(m!.route.controller).toBe("posts");
  });

  it("journeyRecognize filters by HTTP verb", () => {
    const routes = new RouteSet();
    routes.draw((r) => {
      r.get("/x", { to: "a#index" });
      r.post("/x", { to: "b#create" });
    });
    expect(routes.journeyRecognize("GET", "/x")!.route.action).toBe("index");
    expect(routes.journeyRecognize("POST", "/x")!.route.action).toBe("create");
  });

  it("journeyRecognize returns null for unmatched paths", () => {
    const routes = new RouteSet();
    routes.draw((r) => {
      r.get("/posts", { to: "posts#index" });
    });
    expect(routes.journeyRecognize("GET", "/nope")).toBeNull();
  });

  it("journeyRouter cache invalidates on draw and clear", () => {
    const routes = new RouteSet();
    routes.draw((r) => r.get("/a", { to: "a#index" }));
    const first = routes.journeyRouter;
    routes.draw((r) => r.get("/b", { to: "b#index" }));
    expect(routes.journeyRouter).not.toBe(first);
    routes.clear();
    expect(routes.journeyRouter).not.toBe(first);
  });

  it("journeyRecognize honors regex constraints", () => {
    const routes = new RouteSet();
    routes.draw((r) => {
      r.get("/posts/:id", { to: "posts#show", constraints: { id: /\d+/ } });
    });
    expect(routes.journeyRecognize("GET", "/posts/42")).not.toBeNull();
    expect(routes.journeyRecognize("GET", "/posts/abc")).toBeNull();
  });
});
