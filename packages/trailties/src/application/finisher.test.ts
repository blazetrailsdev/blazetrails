// Mirrors railties/test/application/initializers/finisher_test.rb.
// The ported subset of finisher initializers is exercised against a
// mock host so we don't need the full Application shell (PR 2.5).
import { describe, it, expect } from "vitest";
import {
  Finisher,
  type FinisherConfig,
  type FinisherEnv,
  type FinisherHost,
  type FinisherReloader,
  type FinisherRoutes,
} from "./finisher.js";
import type { ConfigurationBlock } from "../trailtie/configuration.js";

function buildHost(env: "development" | "production" = "development"): {
  app: FinisherHost & Finisher;
  calls: string[];
  internalRoutes: string[];
  toPrepared: ConfigurationBlock[];
  mountedHelpers: string[];
} {
  const calls: string[] = [];
  const internalRoutes: string[] = [];
  const toPrepared: ConfigurationBlock[] = [];
  const mountedHelpers: string[] = [];

  class TestApp extends Finisher implements FinisherHost {
    config: FinisherConfig = { toPrepareBlocks: [] };
    env: FinisherEnv = { isDevelopment: () => env === "development" };
    routes: FinisherRoutes = {
      prepend: (block) => block(),
      defineMountedHelper: (name) => mountedHelpers.push(name),
    };
    reloader: FinisherReloader = {
      toPrepare: (block) => toPrepared.push(block),
      prepareBang: () => calls.push("prepare!"),
    };
    ensureGeneratorTemplatesAdded(): void {
      calls.push("generator_templates");
    }
    buildMiddlewareStack(): void {
      calls.push("middleware_stack");
    }
    appendInternalRoute(verb: string, path: string, to: string): void {
      internalRoutes.push(`${verb} ${path} -> ${to}`);
    }
  }

  return {
    app: new TestApp() as FinisherHost & Finisher,
    calls,
    internalRoutes,
    toPrepared,
    mountedHelpers,
  };
}

describe("Finisher", () => {
  it("registers the ported finisher initializers in Rails order", () => {
    const names = Finisher._ownInitializers().map((i) => i.name);
    expect(names).toEqual([
      "add_generator_templates",
      "add_internal_routes",
      "build_middleware_stack",
      "define_main_app_helper",
      "add_to_prepare_blocks",
      "run_prepare_callbacks",
    ]);
  });

  it("does not register the intentionally skipped initializers", () => {
    const names = Finisher._ownInitializers().map((i) => i.name);
    expect(names).not.toContain("eager_load!");
    expect(names).not.toContain("setup_main_autoloader");
    expect(names).not.toContain("set_routes_reloader_hook");
    expect(names).not.toContain("set_clear_dependencies_hook");
    expect(names).not.toContain("enable_yjit");
    expect(names).not.toContain("configure_executor_for_concurrency");
  });

  it("add_generator_templates calls ensureGeneratorTemplatesAdded", () => {
    const { app, calls } = buildHost();
    app.initializers.find((i) => i.name === "add_generator_templates")!.run(app);
    expect(calls).toContain("generator_templates");
  });

  it("build_middleware_stack calls buildMiddlewareStack", () => {
    const { app, calls } = buildHost();
    app.initializers.find((i) => i.name === "build_middleware_stack")!.run(app);
    expect(calls).toContain("middleware_stack");
  });

  it("define_main_app_helper defines the main_app mounted helper", () => {
    const { app, mountedHelpers } = buildHost();
    app.initializers.find((i) => i.name === "define_main_app_helper")!.run(app);
    expect(mountedHelpers).toEqual(["main_app"]);
  });

  it("add_to_prepare_blocks forwards config.toPrepareBlocks to the reloader", () => {
    const { app, toPrepared } = buildHost();
    const block: ConfigurationBlock = () => {};
    app.config.toPrepareBlocks.push(block);
    app.initializers.find((i) => i.name === "add_to_prepare_blocks")!.run(app);
    expect(toPrepared).toEqual([block]);
  });

  it("run_prepare_callbacks runs reloader.prepare!", () => {
    const { app, calls } = buildHost();
    app.initializers.find((i) => i.name === "run_prepare_callbacks")!.run(app);
    expect(calls).toContain("prepare!");
  });

  it("add_internal_routes prepends rails/info routes in development", () => {
    const { app, internalRoutes } = buildHost("development");
    app.initializers.find((i) => i.name === "add_internal_routes")!.run(app);
    expect(internalRoutes).toEqual([
      "get /rails/info/properties -> rails/info#properties",
      "get /rails/info/routes -> rails/info#routes",
      "get /rails/info/notes -> rails/info#notes",
      "get /rails/info -> rails/info#index",
    ]);
  });

  it("add_internal_routes is a no-op outside development", () => {
    const { app, internalRoutes } = buildHost("production");
    app.initializers.find((i) => i.name === "add_internal_routes")!.run(app);
    expect(internalRoutes).toEqual([]);
  });

  it("runs all finisher initializers in order via runInitializers", () => {
    const { app, calls } = buildHost();
    app.runInitializers();
    expect(calls).toEqual(["generator_templates", "middleware_stack", "prepare!"]);
  });
});
