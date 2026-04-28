import { serializableHash as amSerializableHash } from "@blazetrails/activemodel";
import type { Base } from "./base.js";

/**
 * Serialization options for filtering attributes.
 */
interface SerializeOptions {
  only?: string[];
  except?: string[];
  methods?: string[];
  include?: Record<string, SerializeOptions> | string[] | string;
}

/**
 * Wrapper around ActiveModel serialization to handle ActiveRecord-specific
 * concerns like inheritance columns (STI).
 *
 * Mirrors: ActiveRecord::Serialization#serializable_hash
 */
export function serializableHash(this: Base, options?: SerializeOptions): Record<string, unknown> {
  // When a model uses STI, we need to exclude the inheritance column
  // from the serialized output (it's just for internal type routing).
  const klass = this.constructor as typeof Base;
  const inheritanceCol = klass.inheritanceColumn;
  if (inheritanceCol && klass.hasAttribute(inheritanceCol)) {
    options = options ? { ...options } : {};

    // Normalize except to an array of strings
    options.except = Array.from(options.except || []).map((v) => String(v));
    // Add the inheritance column to the except list
    options.except = [...new Set(options.except), inheritanceCol];
  }

  return amSerializableHash(this, options);
}

// private

/**
 * Filters attribute names for serialization. Returns the list of attribute
 * names that should be included in serialization.
 *
 * In ActiveRecord, this is overridable per model (e.g., to exclude certain attrs).
 * The base implementation just delegates to the attribute_names method.
 *
 * Mirrors: ActiveRecord::Serialization.private#attribute_names_for_serialization
 */
export function attributeNamesForSerialization(this: Base): string[] {
  return this.attributeNames();
}
