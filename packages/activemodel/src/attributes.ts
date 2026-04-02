import { Type } from "./type/value.js";
import { typeRegistry } from "./type/registry.js";

export interface AttributeDefinition {
  name: string;
  type: Type;
  defaultValue: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Attributes mixin contract — declares typed attributes with defaults and casting.
 *
 * Mirrors: ActiveModel::Attributes
 */
export interface Attributes {
  attributes: Record<string, unknown>;
  attributeNames(): string[];
}

// ---------------------------------------------------------------------------
// Shared logic — used by AttributesBase, Attributes() mixin, and Model
// ---------------------------------------------------------------------------

export function initializeAttributes(
  target: Map<string, unknown>,
  defs: Map<string, AttributeDefinition>,
  initial: Record<string, unknown>,
): void {
  for (const [name, def] of defs) {
    if (name in initial) {
      target.set(name, def.type.cast(initial[name]));
    } else {
      const defVal = typeof def.defaultValue === "function" ? def.defaultValue() : def.defaultValue;
      target.set(name, defVal);
    }
  }
}

export function attributesToHash(attrs: Map<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of attrs) {
    result[k] = v;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Attributes() mixin — for composing into class hierarchies
// ---------------------------------------------------------------------------

export interface AttributesStatic {
  _attributeDefinitions: Map<string, AttributeDefinition>;
  attribute(name: string, typeName: string, options?: { default?: unknown }): void;
  attributeNames(): string[];
}

export interface AttributesInstance {
  _attributes: Map<string, unknown>;
  readAttribute(name: string): unknown;
  writeAttribute(name: string, value: unknown): void;
  attributes: Record<string, unknown>;
  attributePresent(name: string): boolean;
}

export function Attributes<TBase extends Constructor>(Base: TBase) {
  class AttributesMixin extends Base implements AttributesInstance {
    static _attributeDefinitions: Map<string, AttributeDefinition> = new Map();

    static attribute(name: string, typeName: string, options?: { default?: unknown }): void {
      const type = typeRegistry.lookup(typeName);
      const defaultValue = options?.default ?? null;
      this._attributeDefinitions.set(name, { name, type, defaultValue });
    }

    static attributeNames(): string[] {
      return Array.from(this._attributeDefinitions.keys());
    }

    _attributes: Map<string, unknown> = new Map();
    #initialized = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);
      this.#initAttributes((args[0] as Record<string, unknown>) ?? {});
    }

    #initAttributes(initial: Record<string, unknown>) {
      if (this.#initialized) return;
      this.#initialized = true;
      const ctor = this.constructor as typeof AttributesMixin;
      const defs: Map<string, AttributeDefinition> = ctor._attributeDefinitions ?? new Map();
      initializeAttributes(this._attributes, defs, initial);
    }

    readAttribute(name: string): unknown {
      return this._attributes.get(name) ?? null;
    }

    writeAttribute(name: string, value: unknown): void {
      const ctor = this.constructor as typeof AttributesMixin;
      const def = ctor._attributeDefinitions?.get(name);
      this._attributes.set(name, def ? def.type.cast(value) : value);
    }

    get attributes(): Record<string, unknown> {
      return attributesToHash(this._attributes);
    }

    attributePresent(name: string): boolean {
      const value = this._attributes.get(name);
      if (value === null || value === undefined) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    }
  }

  return AttributesMixin;
}
