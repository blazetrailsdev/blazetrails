/**
 * Port of `Rails::Application::Finisher` from
 * `railties/lib/rails/application/finisher.rb`. Defines the finisher
 * initializers that run after the Trailtie initializers and bootstrap.
 *
 * Application (PR 2.5) will splice these into its initializer chain.
 * Until then, this class can stand alone so tests can exercise the
 * declarations and block bodies against a mock host.
 *
 * The Rails initializers tied to Zeitwerk, eager loading, the
 * reloader/executor concurrency hooks, session store defaults, the
 * routes-reloader hook, and YJIT are intentionally not ported here —
 * they depend on subsystems we don't have or are out of scope per the
 * trailties plan.
 */
import { Initializable } from "../initializable.js";
import type { ConfigurationBlock } from "../trailtie/configuration.js";

export interface FinisherRoutes {
  prepend(block: () => void): void;
  defineMountedHelper(name: string): void;
}

export interface FinisherReloader {
  toPrepare(block: ConfigurationBlock): void;
  prepareBang(): void;
}

export interface FinisherConfig {
  toPrepareBlocks: ConfigurationBlock[];
}

export interface FinisherEnv {
  isDevelopment(): boolean;
}

export interface FinisherHost {
  config: FinisherConfig;
  routes: FinisherRoutes;
  reloader: FinisherReloader;
  env: FinisherEnv;
  ensureGeneratorTemplatesAdded(): void;
  buildMiddlewareStack(): void;
  appendInternalRoute(verb: string, path: string, to: string): void;
}

export class Finisher extends Initializable {}

Finisher.initializer("add_generator_templates", function (this: FinisherHost) {
  this.ensureGeneratorTemplatesAdded();
});

Finisher.initializer("add_internal_routes", function (this: FinisherHost, app?: unknown) {
  const host = (app as FinisherHost | undefined) ?? this;
  if (!host.env.isDevelopment()) return;
  host.routes.prepend(() => {
    host.appendInternalRoute("get", "/rails/info/properties", "rails/info#properties");
    host.appendInternalRoute("get", "/rails/info/routes", "rails/info#routes");
    host.appendInternalRoute("get", "/rails/info/notes", "rails/info#notes");
    host.appendInternalRoute("get", "/rails/info", "rails/info#index");
  });
});

Finisher.initializer("build_middleware_stack", function (this: FinisherHost) {
  this.buildMiddlewareStack();
});

Finisher.initializer("define_main_app_helper", function (this: FinisherHost, app?: unknown) {
  const host = (app as FinisherHost | undefined) ?? this;
  host.routes.defineMountedHelper("main_app");
});

Finisher.initializer("add_to_prepare_blocks", function (this: FinisherHost, app?: unknown) {
  const host = (app as FinisherHost | undefined) ?? this;
  for (const block of host.config.toPrepareBlocks) {
    host.reloader.toPrepare(block);
  }
});

Finisher.initializer("run_prepare_callbacks", function (this: FinisherHost, app?: unknown) {
  const host = (app as FinisherHost | undefined) ?? this;
  host.reloader.prepareBang();
});
