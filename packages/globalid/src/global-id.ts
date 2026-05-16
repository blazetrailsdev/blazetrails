import { getApp } from "./config.js";
import {
  buildGid,
  normalizeModelId,
  parseGid,
  validateApp,
  type GidComponents,
} from "./uri/gid.js";
import { Locator, lookupClass, type LocateOptions, type LocatorModel } from "./locator.js";
import { SignedGlobalID } from "./signed-global-id.js";

export interface GlobalIDModel {
  id: unknown;
  constructor: { name: string };
}

export interface GlobalIDOptions {
  app?: string;
  [key: string]: unknown;
}

export class GlobalID {
  readonly uri: string;
  private readonly _components: GidComponents;

  private constructor(uri: string, components: GidComponents) {
    this.uri = uri;
    this._components = components;
  }

  get app(): string {
    return this._components.app;
  }
  get modelName(): string {
    return this._components.modelName;
  }
  get modelId(): string | string[] {
    return this._components.modelId;
  }
  get params(): Record<string, string> {
    return this._components.params;
  }

  /** Mirrors: GlobalID.create */
  static create(model: GlobalIDModel, options: GlobalIDOptions = {}): GlobalID {
    const app = options.app ?? getApp();
    if (!app) {
      throw new Error(
        "An app is required to create a GlobalID. Pass the :app option or set the default GlobalID.app via setApp().",
      );
    }
    const { app: _a, verifier: _v, for: _f, ...rest } = options as Record<string, unknown>;
    const filteredParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v != null) filteredParams[k] = String(v);
    }
    const modelName = model.constructor.name;
    const params = Object.keys(filteredParams).length ? filteredParams : null;
    const uri = buildGid(app, modelName, model.id, params);
    const components: GidComponents = {
      app,
      modelName,
      modelId: normalizeModelId(model.id, modelName),
      params: params ?? {},
    };
    return new GlobalID(uri, components);
  }

  /** Mirrors: GlobalID.parse — falls back to base64-decoded form. */
  static parse(gid: string | GlobalID, _options: GlobalIDOptions = {}): GlobalID | null {
    if (gid instanceof GlobalID) return gid;
    try {
      return new GlobalID(gid, parseGid(gid));
    } catch {
      try {
        const b64 = gid.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
        return new GlobalID(decoded, parseGid(decoded));
      } catch {
        return null;
      }
    }
  }

  /** Mirrors: GlobalID#to_param — base64url without padding. */
  toParam(): string {
    return btoa(this.uri).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  toString(): string {
    return this.uri;
  }

  /** Mirrors: GlobalID#as_json — `JSON.stringify(gid)` produces `"gid://..."`. */
  toJSON(): string {
    return this.uri;
  }

  /** @internal */
  [Symbol.toPrimitive](_hint: string): string {
    return this.uri;
  }

  /** Mirrors: GlobalID#== */
  equals(other: GlobalID): boolean {
    return other instanceof GlobalID && this.uri === other.uri;
  }

  /** Mirrors: GlobalID.app= validation */
  static validateApp(app: string | null | undefined): string {
    return validateApp(app);
  }

  /**
   * Resolve the model class via the registered ModelFinder.
   *
   * Mirrors: GlobalID#model_class — `model_name.constantize`. Raises if the
   * resolved class is GlobalID / SignedGlobalID (Rails has the same guard
   * against recursive `model_class` lookup).
   */
  get modelClass(): LocatorModel {
    const klass = lookupClass(this.modelName);
    if (!klass) {
      throw new Error(
        `Cannot resolve model class for ${this.modelName}. Register the class via setModelFinder.`,
      );
    }
    // Rails: `if model <= GlobalID then raise ArgumentError` — in Ruby
    // SignedGlobalID < GlobalID so the single check covers both. In TS
    // they're peers, so reject both identities explicitly.
    if (
      klass === (GlobalID as unknown as LocatorModel) ||
      klass === (SignedGlobalID as unknown as LocatorModel)
    ) {
      throw new Error("GlobalID and SignedGlobalID cannot be used as model_class.");
    }
    return klass;
  }

  /**
   * Find the record this GID references.
   *
   * Mirrors: GlobalID#find — delegates to `Locator.locate(self, options)`.
   */
  find(options?: LocateOptions): Promise<unknown | null> {
    return Locator.locate(this, options);
  }
}
