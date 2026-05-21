import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mapper } from "@blazetrails/actionpack";
import { LazyRouteSet, resetReloadRoutesHook, setReloadRoutesHook } from "./lazy-route-set.js";

describe("LazyRouteSet", () => {
  let routes: LazyRouteSet;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    routes = new LazyRouteSet();
    reload = vi.fn(() => true);
    setReloadRoutesHook(reload);
  });

  afterEach(() => {
    resetReloadRoutesHook();
  });

  it("calls reload before draw", () => {
    routes.draw(() => {});
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("calls reload before recognize_path", () => {
    routes.draw((m: Mapper) => {
      m.get("/posts", { to: "posts#index" });
    });
    reload.mockClear();
    routes.recognizePath("/posts");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("calls reload before generate_extras", () => {
    routes.draw((m: Mapper) => {
      m.get("/posts", { to: "posts#index", as: "posts" });
    });
    reload.mockClear();
    routes.generateExtras({ use_route: "posts" });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("calls reload before serve (Rails: call)", () => {
    reload.mockClear();
    try {
      routes.serve({
        pathInfo: "/posts",
        scriptName: "",
        requestMethod: "GET",
        pathParameters: {},
      });
    } catch {
      // Journey raises without a finalised route table; we only assert the reload hook fired.
    }
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("wraps url helpers with reload", () => {
    const mod = routes.generateUrlHelpers(true) as unknown as {
      urlFor: (o: Record<string, unknown>) => string;
    };
    expect(() => mod.urlFor({ host: "example.com" })).toThrow();
    expect(reload).toHaveBeenCalled();
  });

  it("tolerates a missing application (default hook is a no-op)", () => {
    resetReloadRoutesHook();
    expect(() => routes.draw(() => {})).not.toThrow();
  });
});
