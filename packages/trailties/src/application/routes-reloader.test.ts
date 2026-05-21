// Mirrors `railties/test/application/routes_reloading_test.rb` for the
// subset of behavior the trailties RoutesReloader implements.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onLoad, resetLoadHooks } from "@blazetrails/activesupport";
import { RoutesReloader, type RouteSetLike } from "./routes-reloader.js";

type Counted = RouteSetLike & { clearCalls: number; finalizeCalls: number; eagerLoadCalls: number };
const makeRouteSet = (): Counted => ({
  disableClearAndFinalize: false,
  clearCalls: 0,
  finalizeCalls: 0,
  eagerLoadCalls: 0,
  clear() {
    (this as Counted).clearCalls += 1;
  },
  finalize() {
    (this as Counted).finalizeCalls += 1;
  },
  eagerLoad() {
    (this as Counted).eagerLoadCalls += 1;
  },
});

describe("RoutesReloader", () => {
  beforeEach(() => resetLoadHooks());
  afterEach(() => resetLoadHooks());

  it("test_reload_clears_finalizes_eager_loads_and_runs_after_load_paths", async () => {
    const r = new RoutesReloader();
    expect([r.paths, r.routeSets, r.externalRoutes]).toEqual([[], [], []]);
    expect(r.eagerLoad).toBe(false);
    expect(r.loaded).toBe(false);
    const a = makeRouteSet();
    r.routeSets.push(a);
    r.paths.push("/routes-a", "/routes-b");
    r.eagerLoad = true;
    const loaded: string[] = [];
    const after = vi.fn();
    r.runAfterLoadPaths = after;
    await r.reload((p) => void loaded.push(p));
    expect(loaded).toEqual(["/routes-a", "/routes-b"]);
    expect(after).toHaveBeenCalledOnce();
    expect([a.clearCalls, a.finalizeCalls, a.eagerLoadCalls]).toEqual([1, 1, 1]);
    expect(a.disableClearAndFinalize).toBe(false);
  });

  it("test_reload_reverts_disable_flag_even_when_loader_throws", async () => {
    const r = new RoutesReloader();
    const a = makeRouteSet();
    r.routeSets.push(a);
    r.paths.push("/boom");
    await expect(
      r.reload(() => {
        throw new Error("load failed");
      }),
    ).rejects.toThrow(/load failed/);
    expect(a.disableClearAndFinalize).toBe(false);
  });

  it("test_execute_unless_loaded_runs_once_and_fires_after_routes_loaded", async () => {
    const r = new RoutesReloader();
    const fired: unknown[] = [];
    onLoad("after_routes_loaded", (app) => void fired.push(app));
    const app = { tag: "app" };
    expect(await r.executeUnlessLoaded(app)).toBe(true);
    expect(r.loaded).toBe(true);
    expect(fired).toEqual([app]);
    expect(await r.executeUnlessLoaded(app)).toBe(false);
    expect(fired).toEqual([app]);
  });
});
