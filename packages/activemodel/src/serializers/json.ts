import { serializableHash, type SerializeOptions } from "../serialization.js";
import { Naming, type ModelName } from "../naming.js";

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
  static includeRootInJson = false;

  // Rails: included do; extend ActiveModel::Naming; end — surfaces
  // model_name on the host class. Subclasses override to customize.
  static get modelName(): ModelName {
    return Naming.modelNameFromRecordOrClass(this as unknown as { modelName: ModelName });
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
    const hash = this.serializableHash(options);
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
    let hash = globalThis.JSON.parse(json) as Record<string, unknown>;
    if (root) {
      hash = Object.values(hash)[0] as Record<string, unknown>;
    }
    (this as unknown as { attributes: Record<string, unknown> }).attributes = hash;
    return this;
  }
}
