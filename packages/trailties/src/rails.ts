// Port of `Rails` module from `railties/lib/rails.rb`.
// Renamed `Rails` → `Trails`; `api:compare` wires the alias via the
// `Rails: "Trails"` entry in `TS_CLASS_RENAMES` (compare.ts).
import { EnvironmentInquirer, getEnv } from "@blazetrails/activesupport";
import type { CacheStore, Logger } from "@blazetrails/activesupport";
import { Application } from "./application.js";
import { BacktraceCleaner } from "./backtrace-cleaner.js";
import type { Configuration } from "./application/configuration.js";
import { VERSION } from "./version.js";

let _application: Application | null = null;
let _cache: CacheStore | null = null;
let _logger: Logger | null = null;
let _env: EnvironmentInquirer | undefined;
let _backtraceCleaner: BacktraceCleaner | undefined;

function resolveDefaultEnv(): string {
  return getEnv("TRAILS_ENV") ?? getEnv("NODE_ENV") ?? "development";
}

/**
 * Trails-renamed `Rails` module. Exposed as an object literal with
 * accessors because TS has no module-singleton pattern. Mutations flow
 * through explicit setters (`Trails.application = app`,
 * `Trails.env = "test"`).
 *
 * `Trails.version` returns the `@blazetrails/trailties` package version
 * (`packages/trailties/src/version.ts`), NOT the tracked Rails upstream
 * version — resolves open question #3 in `docs/trailties-plan.md`.
 */
export const Trails = {
  get application(): Application | null {
    if (_application) return _application;
    const klass = Application.appClass;
    return klass ? (klass.instance() as Application) : null;
  },
  set application(app: Application | null) {
    _application = app;
  },

  get cache(): CacheStore | null {
    return _cache;
  },
  set cache(value: CacheStore | null) {
    _cache = value;
  },

  get logger(): Logger | null {
    return _logger;
  },
  set logger(value: Logger | null) {
    _logger = value;
  },

  get version(): string {
    return VERSION;
  },

  /** Rails: `Rails.configuration` → `application.config`. */
  get configuration(): Configuration | null {
    return Trails.application?.config ?? null;
  },

  /**
   * Rails: `@_env ||= ActiveSupport::EnvironmentInquirer.new(...)`.
   * Trails env precedence: `TRAILS_ENV`, then `NODE_ENV`, defaulting to
   * `"development"` — matches `resolveEnv()` in `database.ts`.
   */
  get env(): EnvironmentInquirer {
    return (_env ??= new EnvironmentInquirer(resolveDefaultEnv()));
  },
  set env(value: string | EnvironmentInquirer) {
    _env = typeof value === "string" ? new EnvironmentInquirer(value) : value;
  },

  /** Rails: `delegate :initialize!, to: :application`. Throws when no app
   * is registered, matching Rails' `NoMethodError` on `nil.initialize!`. */
  async initialize(group?: string): Promise<Application> {
    const app = Trails.application;
    if (!app)
      throw new Error("Trails.application is not set — register an Application subclass first.");
    return app.initialize(group as Parameters<Application["initialize"]>[0]);
  },

  /** Rails: `delegate :initialized?, to: :application`. */
  initialized(): boolean {
    return Trails.application?.initialized() ?? false;
  },

  get backtraceCleaner(): BacktraceCleaner {
    return (_backtraceCleaner ??= new BacktraceCleaner());
  },

  /** Rails: `application && application.config.root`. */
  async root(): Promise<string | undefined> {
    return Trails.application?.root();
  },

  /** Rails: `application && Pathname.new(application.paths["public"].first)`. */
  async publicPath(): Promise<string | null> {
    const app = Trails.application;
    if (!app) return null;
    const paths = await app.paths();
    const expanded = await paths.get("public")?.expanded();
    return expanded?.[0] ?? null;
  },

  /**
   * Rails: `Rails.groups(*groups)`. Combines `"default"`, current env, the
   * `TRAILS_GROUPS` env var, and option-hash keys whose value array
   * includes the current env. Result is deduped, preserving insertion
   * order.
   */
  groups(...args: Array<string | Record<string, string[]>>): string[] {
    const last = args[args.length - 1];
    const opts = last && typeof last === "object" ? (args.pop() as Record<string, string[]>) : {};
    const env = Trails.env.toString();
    const out: string[] = ["default", env, ...(args as string[])];
    const envGroups = getEnv("TRAILS_GROUPS");
    if (envGroups) for (const g of envGroups.split(",")) if (g) out.push(g);
    for (const [k, envs] of Object.entries(opts)) {
      if (envs.includes(env)) out.push(k);
    }
    return [...new Set(out)];
  },
};

/** @internal Test-only — drops the cached EnvironmentInquirer. */
export function _resetTrailsEnv(): void {
  _env = undefined;
}
