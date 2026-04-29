import { serializableHash, coerceForJson, type SerializeOptions } from "../serialization.js";
import { ModelName } from "../naming.js";

/**
 * JSON serializer mixin host.
 *
 * Mirrors: ActiveModel::Serializers::JSON (json.rb:9-13)
 *
 *   module JSON
 *     extend ActiveSupport::Concern
 *     include ActiveModel::Serialization
 *
 *     included do
 *       extend ActiveModel::Naming
 *       class_attribute :include_root_in_json, instance_writer: false, default: false
 *     end
 *     ...
 *
 * Rails ships JSON as a module that pulls in `Serialization` (giving
 * `serializable_hash`) and extends `Naming` (giving `model_name`).
 * Trails' `Model` already wires up `asJson` / `fromJson`; this class
 * is the canonical mixin host for lighter-weight adopters and the
 * file-level Rails surface (`serializable_hash`, `model_name`).
 */
export class JSON {
  // Rails: included do; class_attribute :include_root_in_json, default: false; end
  // Typed boolean | string to match Model.includeRootInJson — Rails
  // accepts a string here too (treated as a custom root key by as_json).
  static includeRootInJson: boolean | string = false;

  // Per-class memo so the static getter can be inherited without
  // recomputing or sharing state across subclasses (matches Model's
  // model.ts:1179-1185 pattern).
  protected static _modelName?: ModelName;

  // Rails: included do; extend ActiveModel::Naming; end — surfaces
  // model_name on the host class. Subclasses override to customize.
  static get modelName(): ModelName {
    if (!this._modelName || this._modelName.name !== this.name) {
      this._modelName = new ModelName(this.name, { klass: this as unknown as { name: string } });
    }
    return this._modelName;
  }

  /**
   * Mirrors: ActiveModel::Serialization#serializable_hash
   * (serialization.rb), included into JSON via `include
   * ActiveModel::Serialization`. Delegates to the canonical
   * implementation in `serialization.ts` so a subclass that mixes in
   * the JSON host gets the same Rails semantics for `:only`, `:except`,
   * `:methods`, `:include`.
   */
  serializableHash(options?: SerializeOptions): Record<string, unknown> {
    return serializableHash(this as unknown as Parameters<typeof serializableHash>[0], options);
  }

  /**
   * Mirrors: json.rb:96-108
   *   def as_json(options = nil)
   *     root = if options&.key?(:root) then options[:root] else include_root_in_json end
   *     hash = serializable_hash(options).as_json
   *     if root
   *       root = model_name.element if root == true
   *       { root => hash }
   *     else
   *       hash
   *     end
   *   end
   */
  asJson(options?: SerializeOptions & { root?: boolean | string }): Record<string, unknown> {
    const ctor = this.constructor as typeof JSON;
    const rootOpt =
      options && Object.prototype.hasOwnProperty.call(options, "root")
        ? options.root
        : ctor.includeRootInJson;
    // Rails calls `serializable_hash(options).as_json` — recursive
    // JSON-coerce on the resulting hash. Mirror that with coerceForJson
    // so JSON-unsafe values (bigint, undefined, cyclic refs, etc.)
    // surface predictably, matching Model.asJson (model.ts:1708).
    const hash = coerceForJson(this.serializableHash(options)) as Record<string, unknown>;
    if (!rootOpt) return hash;
    const rootKey = rootOpt === true ? ctor.modelName.element : (rootOpt as string);
    return { [rootKey]: hash };
  }

  /**
   * Mirrors: json.rb:144-149
   *   def from_json(json, include_root = include_root_in_json)
   *     hash = ActiveSupport::JSON.decode(json)
   *     hash = hash.values.first if include_root
   *     self.attributes = hash
   *     self
   *   end
   */
  fromJson(json: string, includeRoot?: boolean): this {
    const ctor = this.constructor as typeof JSON;
    const root = includeRoot ?? ctor.includeRootInJson;
    let hash = globalThis.JSON.parse(json) as unknown;
    // Rails calls `hash.values.first` and raises NoMethodError if the
    // decoded JSON isn't a Hash. Surface the same failure mode loudly
    // instead of silently writing `undefined` into `attributes`.
    if (hash === null || typeof hash !== "object" || Array.isArray(hash)) {
      throw new TypeError(`fromJson expected a JSON object, got ${typeof hash}`);
    }
    if (root) {
      // When includeRootInJson is a string, prefer the explicit key so
      // multi-key payloads still unwrap deterministically; otherwise fall
      // back to first-value semantics (Rails json.rb:147 hash.values.first).
      hash =
        typeof ctor.includeRootInJson === "string" &&
        Object.prototype.hasOwnProperty.call(hash, ctor.includeRootInJson)
          ? (hash as Record<string, unknown>)[ctor.includeRootInJson]
          : Object.values(hash as Record<string, unknown>)[0];
      if (hash === null || typeof hash !== "object" || Array.isArray(hash)) {
        throw new TypeError(`fromJson root payload must be a JSON object, got ${typeof hash}`);
      }
    }
    (this as unknown as { attributes: Record<string, unknown> }).attributes = hash as Record<
      string,
      unknown
    >;
    return this;
  }

  /**
   * `JSON.stringify(instance)` consults a `toJSON` method when present.
   * Delegating to `asJson()` ensures the host runs the same coercion +
   * root-wrapping as the Rails entry point. Mirrors Model.toJSON
   * (model.ts) and matches the surface ActiveSupport adds on Object via
   * `as_json` indirection in Rails.
   */
  toJSON(): Record<string, unknown> {
    return this.asJson();
  }

  /** Lower-camel alias for callers that prefer the Ruby-style name. */
  toJson(): Record<string, unknown> {
    return this.toJSON();
  }
}
