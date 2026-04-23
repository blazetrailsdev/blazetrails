import {
  underscore,
  pluralize,
  singularize,
  humanize,
  demodulize,
  tableize,
} from "@blazetrails/activesupport";

/**
 * Naming mixin — provides model_name on classes and naming helpers.
 *
 * Mirrors: ActiveModel::Naming
 */
export interface Naming {
  readonly modelName: ModelName;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Naming {
  type RecordOrClass =
    | ModelName
    | { modelName: ModelName }
    | { constructor: { modelName: ModelName } };

  export function modelNameFromRecordOrClass(recordOrClass: RecordOrClass): ModelName {
    if (recordOrClass instanceof ModelName) return recordOrClass;
    if ("modelName" in recordOrClass) return recordOrClass.modelName;
    return (recordOrClass.constructor as { modelName: ModelName }).modelName;
  }

  export function plural(recordOrClass: RecordOrClass): string {
    return modelNameFromRecordOrClass(recordOrClass).plural;
  }

  export function singular(recordOrClass: RecordOrClass): string {
    return modelNameFromRecordOrClass(recordOrClass).singular;
  }

  export function isUncountable(recordOrClass: RecordOrClass): boolean {
    const mn = modelNameFromRecordOrClass(recordOrClass);
    return mn.singular === mn.plural;
  }

  export function singularRouteKey(recordOrClass: RecordOrClass): string {
    return modelNameFromRecordOrClass(recordOrClass).singularRouteKey;
  }

  export function routeKey(recordOrClass: RecordOrClass): string {
    return modelNameFromRecordOrClass(recordOrClass).routeKey;
  }

  export function paramKey(recordOrClass: RecordOrClass): string {
    return modelNameFromRecordOrClass(recordOrClass).paramKey;
  }
}
import { I18n } from "./i18n.js";

interface ModelLike {
  readonly name: string;
  i18nScope?: string;
  lookupAncestors?: () => ModelLike[];
  modelName?: ModelName;
}

/**
 * Rails `_singularize(string)` — activemodel/lib/active_model/naming.rb:216-218:
 *
 *   def _singularize(string)
 *     ActiveSupport::Inflector.underscore(string).tr("/", "_")
 *   end
 *
 * Note: despite the Ruby method name, this does *not* call `singularize`;
 * it snake_cases a class name and flattens `/` separators.
 */
function _singularize(str: string): string {
  return underscore(str).replace(/\//g, "_");
}

export class ModelName {
  readonly name: string;
  readonly singular: string;
  readonly plural: string;
  readonly element: string;
  readonly collection: string;
  readonly paramKey: string;
  readonly routeKey: string;
  readonly singularRouteKey: string;
  readonly i18nKey: string;
  readonly namespace: string | null;
  readonly unnamespaced: string | null;

  private _humanFallback: string;
  private _klass: ModelLike | null;

  private static _uncountables: Set<string> = new Set([
    "sheep",
    "fish",
    "series",
    "species",
    "money",
    "rice",
  ]);

  static addUncountable(word: string): void {
    this._uncountables.add(word.toLowerCase());
  }

  /**
   * Mirrors `ActiveModel::Name#initialize`
   * (activemodel/lib/active_model/naming.rb:166-185):
   *
   *   def initialize(klass, namespace = nil, name = nil, locale = :en)
   *     @name = name || klass.name
   *     @unnamespaced = @name.delete_prefix("#{namespace.name}::") if namespace
   *     @singular = _singularize(@name)
   *     @plural   = pluralize(@singular)
   *     @element  = underscore(demodulize(@name))
   *     @collection = tableize(@name)
   *     @param_key  = namespace ? _singularize(@unnamespaced) : @singular
   *     @i18n_key   = @name.underscore.to_sym
   *     @route_key  = namespace ? pluralize(@param_key) : @plural.dup
   *     @route_key << "_index" if @uncountable
   *
   * The TS signature keeps `className` as the primary positional arg (users
   * typically pass `this.name` from the class) and routes Rails' optional
   * `namespace` / `name` through the options object. Pass `name` to override
   * what we use as `@name` (Rails' third constructor arg); pass `namespace`
   * (the containing module's string name, Rails' `namespace.name`) to scope
   * `paramKey` / `routeKey` to the unnamespaced form.
   */
  constructor(
    className: string,
    options?: { namespace?: string; klass?: ModelLike; name?: string },
  ) {
    this._klass = options?.klass ?? null;
    this.namespace = options?.namespace ?? null;

    // Rails: @name = name || klass.name
    this.name = options?.name ?? className;
    // Rails: @unnamespaced = @name.delete_prefix("#{namespace.name}::") if namespace
    this.unnamespaced = this.namespace
      ? this.name.startsWith(`${this.namespace}::`)
        ? this.name.slice(this.namespace.length + 2)
        : this.name
      : null;

    // Rails: @singular = _singularize(@name)
    this.singular = _singularize(this.name);
    // Rails: @plural = pluralize(@singular)
    this.plural = ModelName._uncountables.has(this.singular)
      ? this.singular
      : pluralize(this.singular);
    const uncountable = this.plural === this.singular;
    // Rails: @element = underscore(demodulize(@name))
    this.element = underscore(demodulize(this.name));
    this._humanFallback = humanize(this.element);
    // Rails: @collection = tableize(@name)  — e.g. "Blog::Post" → "blog/posts"
    this.collection = tableize(this.name);
    // Rails: @param_key = namespace ? _singularize(@unnamespaced) : @singular
    this.paramKey =
      this.namespace && this.unnamespaced != null ? _singularize(this.unnamespaced) : this.singular;
    // Rails: @i18n_key = @name.underscore.to_sym  → "Blog::Post" → :"blog/post"
    this.i18nKey = underscore(this.name);
    // Rails: @route_key = namespace ? pluralize(@param_key) : @plural.dup
    let routeKey = this.namespace ? pluralize(this.paramKey) : this.plural;
    // Rails: @route_key << "_index" if @uncountable
    if (uncountable) routeKey = `${routeKey}_index`;
    this.routeKey = routeKey;
    // Rails: @singular_route_key = singularize(@route_key)
    this.singularRouteKey = singularize(this.routeKey);
  }

  get cacheKey(): string {
    return this.collection;
  }

  get human(): string {
    if (!this._klass) return this._humanFallback;

    const i18nKeys = this._i18nKeys();
    const i18nScope = this._i18nScope();
    if (i18nKeys.length === 0 || i18nScope.length === 0) return this._humanFallback;

    const [primaryKey, ...restKeys] = i18nKeys;
    const scopePrefix = i18nScope.join(".");
    const fullKey = `${scopePrefix}.${primaryKey}`;

    const defaults: Array<{ key: string } | { message: string }> = restKeys.map((k) => ({
      key: `${scopePrefix}.${k}`,
    }));
    defaults.push({ message: this._humanFallback });

    return I18n.t(fullKey, { defaults });
  }

  private _i18nKeys(): string[] {
    if (!this._klass) return [];
    if (typeof this._klass.lookupAncestors === "function") {
      return this._klass.lookupAncestors().map((k) => {
        if (k.modelName) return k.modelName.i18nKey;
        return underscore(k.name);
      });
    }
    return [this.i18nKey];
  }

  private _i18nScope(): string[] {
    if (!this._klass) return [];
    const klassScope = this._klass.i18nScope;
    const scope = typeof klassScope === "string" ? klassScope : "activemodel";
    return [scope, "models"];
  }
}
