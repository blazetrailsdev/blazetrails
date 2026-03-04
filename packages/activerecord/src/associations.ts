import type { Base } from "./base.js";

/**
 * Association options.
 */
export interface AssociationOptions {
  foreignKey?: string;
  className?: string;
  primaryKey?: string;
  dependent?: "destroy" | "nullify" | "delete";
  inverseOf?: string;
}

interface AssociationDefinition {
  type: "belongsTo" | "hasOne" | "hasMany";
  name: string;
  options: AssociationOptions;
}

/**
 * Underscore a camelCase name.
 */
function underscore(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

/**
 * Singularize a plural word (naive).
 */
function singularize(word: string): string {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("zes")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/**
 * CamelCase a snake_case name.
 */
function camelize(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Registry to hold model classes by name. Models must be registered
 * here so associations can resolve class references.
 */
export const modelRegistry = new Map<string, typeof Base>();

/**
 * Register a model class for association resolution.
 */
export function registerModel(model: typeof Base): void {
  modelRegistry.set(model.name, model);
}

/**
 * Resolve a model class by name.
 */
function resolveModel(name: string): typeof Base {
  const model = modelRegistry.get(name);
  if (!model) {
    throw new Error(
      `Model "${name}" not found in registry. Did you call registerModel(${name})?`
    );
  }
  return model;
}

/**
 * Associations mixin — adds belongsTo, hasOne, hasMany to a model class.
 *
 * Mirrors: ActiveRecord::Associations::ClassMethods
 */
export class Associations {
  static _associations: AssociationDefinition[] = [];

  /**
   * Define a belongs_to association.
   *
   * Mirrors: ActiveRecord::Associations::ClassMethods#belongs_to
   */
  static belongsTo(name: string, options: AssociationOptions = {}): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_associations")) {
      this._associations = [...this._associations];
    }
    this._associations.push({ type: "belongsTo", name, options });
  }

  /**
   * Define a has_one association.
   *
   * Mirrors: ActiveRecord::Associations::ClassMethods#has_one
   */
  static hasOne(name: string, options: AssociationOptions = {}): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_associations")) {
      this._associations = [...this._associations];
    }
    this._associations.push({ type: "hasOne", name, options });
  }

  /**
   * Define a has_many association.
   *
   * Mirrors: ActiveRecord::Associations::ClassMethods#has_many
   */
  static hasMany(name: string, options: AssociationOptions = {}): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_associations")) {
      this._associations = [...this._associations];
    }
    this._associations.push({ type: "hasMany", name, options });
  }
}

/**
 * Load a belongs_to association.
 */
export async function loadBelongsTo(
  record: Base,
  assocName: string,
  options: AssociationOptions
): Promise<Base | null> {
  const className =
    options.className ?? camelize(assocName);
  const foreignKey = options.foreignKey ?? `${underscore(assocName)}_id`;
  const primaryKey = options.primaryKey ?? "id";

  const targetModel = resolveModel(className);
  const fkValue = record.readAttribute(foreignKey);
  if (fkValue === null || fkValue === undefined) return null;

  return targetModel.findBy({ [primaryKey]: fkValue });
}

/**
 * Load a has_one association.
 */
export async function loadHasOne(
  record: Base,
  assocName: string,
  options: AssociationOptions
): Promise<Base | null> {
  const ctor = record.constructor as typeof Base;
  const className = options.className ?? camelize(assocName);
  const foreignKey = options.foreignKey ?? `${underscore(ctor.name)}_id`;
  const primaryKey = options.primaryKey ?? ctor.primaryKey;

  const targetModel = resolveModel(className);
  const pkValue = record.readAttribute(primaryKey);
  if (pkValue === null || pkValue === undefined) return null;

  return targetModel.findBy({ [foreignKey]: pkValue });
}

/**
 * Load a has_many association.
 */
export async function loadHasMany(
  record: Base,
  assocName: string,
  options: AssociationOptions
): Promise<Base[]> {
  const ctor = record.constructor as typeof Base;
  const className =
    options.className ?? camelize(singularize(assocName));
  const foreignKey = options.foreignKey ?? `${underscore(ctor.name)}_id`;
  const primaryKey = options.primaryKey ?? ctor.primaryKey;

  const targetModel = resolveModel(className);
  const pkValue = record.readAttribute(primaryKey);
  if (pkValue === null || pkValue === undefined) return [];

  const rel = (targetModel as any).all().where({ [foreignKey]: pkValue });
  return rel.toArray();
}
