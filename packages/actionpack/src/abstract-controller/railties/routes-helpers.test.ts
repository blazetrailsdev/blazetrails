import { describe, expect, it, vi } from "vitest";

import { type HelperMethodsModule } from "../helpers.js";
import {
  withRoutesHelpers,
  type RoutesHelpersClassMethods,
  type UrlHelpersRouteSet,
} from "./routes-helpers.js";

function makeRoutes(
  mod: HelperMethodsModule,
  opts: { spy?: ReturnType<typeof vi.fn> } = {},
): UrlHelpersRouteSet {
  return {
    urlHelpers: opts.spy ?? vi.fn().mockReturnValue(mod),
  };
}

describe("withRoutesHelpers", () => {
  it("returns a wiring function that includes routes.urlHelpers on the class", () => {
    const RouteHelper: HelperMethodsModule = { postPath: () => "/posts" };
    const routes = makeRoutes(RouteHelper);

    const wire = withRoutesHelpers(routes);
    const cls: RoutesHelpersClassMethods = {};
    wire(cls);

    expect(cls._helpers!.postPath.call({})).toBe("/posts");
  });

  it("passes include_path_helpers through to routes.urlHelpers", () => {
    const RouteHelper: HelperMethodsModule = { x: () => "x" };
    const spy = vi.fn().mockReturnValue(RouteHelper);
    const wire = withRoutesHelpers({ urlHelpers: spy }, false);
    wire({});
    expect(spy).toHaveBeenCalledWith(false);
  });

  it("defaults include_path_helpers to true (Rails default)", () => {
    const spy = vi.fn().mockReturnValue({});
    withRoutesHelpers({ urlHelpers: spy })({});
    expect(spy).toHaveBeenCalledWith(true);
  });

  it("prefers a class-level railtieRoutesUrlHelpers when defined", () => {
    const Namespaced: HelperMethodsModule = { nsPath: () => "/ns" };
    const RouteHelper: HelperMethodsModule = { fallback: () => "fb" };
    const routesSpy = vi.fn().mockReturnValue(RouteHelper);

    const cls: RoutesHelpersClassMethods = {
      railtieRoutesUrlHelpers: () => Namespaced,
    };
    withRoutesHelpers({ urlHelpers: routesSpy })(cls);

    expect(cls._helpers!.nsPath.call({})).toBe("/ns");
    // Falls back NOT invoked.
    expect(routesSpy).not.toHaveBeenCalled();
  });

  it("walks the class prototype chain for railtieRoutesUrlHelpers (Rails module_parents)", () => {
    const Inherited: HelperMethodsModule = { up: () => "from-parent" };
    const parent = {
      railtieRoutesUrlHelpers: () => Inherited,
    };
    const child: RoutesHelpersClassMethods = Object.create(parent) as RoutesHelpersClassMethods;

    withRoutesHelpers({ urlHelpers: vi.fn() })(child);

    expect(child._helpers!.up.call({})).toBe("from-parent");
  });

  it("passes include_path_helpers through to the namespaced builder too", () => {
    const Namespaced: HelperMethodsModule = { x: () => "x" };
    const nsSpy = vi.fn().mockReturnValue(Namespaced);
    const cls: RoutesHelpersClassMethods = { railtieRoutesUrlHelpers: nsSpy };

    withRoutesHelpers({ urlHelpers: vi.fn() }, false)(cls);

    expect(nsSpy).toHaveBeenCalledWith(false);
  });
});
