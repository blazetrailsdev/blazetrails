import { Type } from "./type/value.js";
import { typeRegistry } from "./type/registry.js";
import { Attribute } from "./attribute.js";
import { AttributeSet } from "./attribute-set.js";

export interface AttributeDefinition {
  name: string;
  type: Type;
  defaultValue: unknown;
  virtual?: boolean;
}

/**
 * Attributes module contract.
 *
 * Mirrors: ActiveModel::Attributes
 */
export interface Attributes {
  readonly attributes: Record<string, unknown>;
  attributeNames(): string[];
}

// ---------------------------------------------------------------------------
// Class methods — Mirrors: ActiveModel::Attributes::ClassMethods
// ---------------------------------------------------------------------------

/**
 * Declare a typed attribute with an optional default.
 *
 * Mirrors: ActiveModel::Attributes::ClassMethods#attribute
 *
 * Model.attribute() delegates here. This is the canonical implementation
 * of the class-level `attribute` declaration.
 */
export function attribute(
  this: { _attributeDefinitions: Map<string, AttributeDefinition>; prototype: object },
  name: string,
  typeName: string,
  options?: { default?: unknown; virtual?: boolean },
): void {
  const type = typeRegistry.lookup(typeName);
  const defaultValue = options?.default ?? null;
  if (!Object.prototype.hasOwnProperty.call(this, "_attributeDefinitions")) {
    this._attributeDefinitions = new Map(this._attributeDefinitions);
  }
  this._attributeDefinitions.set(name, { name, type, defaultValue, virtual: options?.virtual });

  if (!Object.prototype.hasOwnProperty.call(this.prototype, name)) {
    Object.defineProperty(this.prototype, name, {
      get(this: { readAttribute(n: string): unknown }) {
        return this.readAttribute(name);
      },
      set(this: { writeAttribute(n: string, v: unknown): void }, value: unknown) {
        this.writeAttribute(name, value);
      },
      configurable: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Instance methods — Mirrors: ActiveModel::Attributes instance methods
// ---------------------------------------------------------------------------

/**
 * Build default AttributeSet from class definitions.
 *
 * Mirrors: ActiveModel::AttributeRegistration._default_attributes
 */
export function buildDefaultAttributes(defs: Map<string, AttributeDefinition>): AttributeSet {
  const attrMap = new Map<string, Attribute>();
  for (const [name, def] of defs) {
    let defVal = typeof def.defaultValue === "function" ? def.defaultValue() : def.defaultValue;
    if (defVal !== null && typeof defVal === "object") {
      defVal = structuredClone(defVal);
    }
    attrMap.set(name, Attribute.withCastValue(name, defVal ?? null, def.type));
  }
  return new AttributeSet(attrMap);
}

/**
 * Initialize instance attributes lazily from class definitions.
 *
 * Mirrors: ActiveModel::AttributeSet::LazyAttributeHash
 *
 * Rails uses LazyAttributeHash to defer Attribute instantiation until
 * first access. We use LazyAttributeSet which stores definitions and
 * materializes Attribute instances on demand.
 */
export function constructor(defs: Map<string, AttributeDefinition>): AttributeSet {
  return new LazyAttributeSet(defs);
}

/**
 * Lazy attribute set that defers Attribute creation until first access.
 *
 * Mirrors: ActiveModel::AttributeSet::LazyAttributeHash
 */
class LazyAttributeSet extends AttributeSet {
  private _defs: Map<string, AttributeDefinition>;
  private _materialized: Set<string> = new Set();

  constructor(defs: Map<string, AttributeDefinition>) {
    super(new Map());
    this._defs = defs;
  }

  private _materialize(name: string): void {
    if (this._materialized.has(name)) return;
    const def = this._defs.get(name);
    if (!def) return;
    let defVal = typeof def.defaultValue === "function" ? def.defaultValue() : def.defaultValue;
    if (defVal !== null && typeof defVal === "object") {
      defVal = structuredClone(defVal);
    }
    super.set(name, Attribute.withCastValue(name, defVal ?? null, def.type));
    this._materialized.add(name);
  }

  private _materializeAll(): void {
    for (const name of this._defs.keys()) {
      this._materialize(name);
    }
  }

  override getAttribute(name: string): Attribute {
    this._materialize(name);
    return super.getAttribute(name);
  }

  override get(name: string): unknown {
    this._materialize(name);
    return super.get(name);
  }

  override set(name: string, attrOrValue: Attribute | unknown): void {
    this._materialized.add(name);
    super.set(name, attrOrValue);
  }

  override has(name: string): boolean {
    this._materialize(name);
    return super.has(name) || this._defs.has(name);
  }

  override keys(): string[] {
    this._materializeAll();
    return super.keys();
  }

  override fetchValue(name: string): unknown {
    this._materialize(name);
    return super.fetchValue(name);
  }

  override writeFromUser(name: string, value: unknown): unknown {
    if (!this._materialized.has(name)) this._materialize(name);
    return super.writeFromUser(name, value);
  }

  override writeFromDatabase(name: string, value: unknown): void {
    if (!this._materialized.has(name)) this._materialize(name);
    super.writeFromDatabase(name, value);
  }

  override writeCastValue(name: string, value: unknown): void {
    if (!this._materialized.has(name)) this._materialize(name);
    super.writeCastValue(name, value);
  }

  override isKey(name: string): boolean {
    this._materialize(name);
    return super.isKey(name);
  }

  override forEach(fn: (attr: Attribute, name: string) => void): void {
    this._materializeAll();
    super.forEach(fn);
  }

  override toHash(): Record<string, unknown> {
    this._materializeAll();
    return super.toHash();
  }

  override valuesBeforeTypeCast(): Record<string, unknown> {
    this._materializeAll();
    return super.valuesBeforeTypeCast();
  }

  override valuesForDatabase(): Record<string, unknown> {
    this._materializeAll();
    return super.valuesForDatabase();
  }

  override snapshotValues(): Map<string, unknown> {
    this._materializeAll();
    return super.snapshotValues();
  }

  override castTypes(): Record<string, import("./type/value.js").Type> {
    this._materializeAll();
    return super.castTypes();
  }

  override accessed(): string[] {
    this._materializeAll();
    return super.accessed();
  }

  override map(fn: (attr: Attribute) => Attribute): AttributeSet {
    this._materializeAll();
    return super.map(fn);
  }

  override reverseMergeBang(target: AttributeSet): this {
    this._materializeAll();
    return super.reverseMergeBang(target);
  }

  override deepDup(): AttributeSet {
    this._materializeAll();
    return super.deepDup();
  }

  override delete(name: string): boolean {
    this._materialized.add(name);
    return super.delete(name);
  }

  override reset(name: string): void {
    this._materialize(name);
    super.reset(name);
  }
}

/**
 * Return all attributes as a plain hash.
 *
 * Mirrors: ActiveModel::Attributes#attributes
 */
export function attributes(attrs: AttributeSet): Record<string, unknown> {
  return attrs.toHash();
}
