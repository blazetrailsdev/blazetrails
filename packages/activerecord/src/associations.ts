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
  through?: string;
  source?: string;
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
  // Check preloaded cache first
  if ((record as any)._preloadedAssociations?.has(assocName)) {
    return (record as any)._preloadedAssociations.get(assocName) as Base | null;
  }

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
  // Check preloaded cache first
  if ((record as any)._preloadedAssociations?.has(assocName)) {
    return (record as any)._preloadedAssociations.get(assocName) as Base | null;
  }

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
  // Check preloaded cache first
  if ((record as any)._preloadedAssociations?.has(assocName)) {
    return (record as any)._preloadedAssociations.get(assocName) as Base[];
  }

  // Handle through associations
  if (options.through) {
    return loadHasManyThrough(record, assocName, options);
  }

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

/**
 * Load a has_many :through association.
 */
export async function loadHasManyThrough(
  record: Base,
  assocName: string,
  options: AssociationOptions
): Promise<Base[]> {
  const ctor = record.constructor as typeof Base;
  const associations: AssociationDefinition[] = (ctor as any)._associations ?? [];
  const throughAssoc = associations.find((a) => a.name === options.through);
  if (!throughAssoc) {
    throw new Error(`Through association "${options.through}" not found on ${ctor.name}`);
  }

  // Load through records
  const throughRecords = await loadHasMany(record, throughAssoc.name, throughAssoc.options);

  // Resolve the target model
  const className = options.className ?? camelize(singularize(assocName));
  const targetModel = resolveModel(className);

  // The source defaults to the singularized association name
  const sourceName = options.source ?? singularize(assocName);
  const targetFk = `${underscore(sourceName)}_id`;

  // Collect target IDs from through records
  const targetIds = throughRecords
    .map((r) => r.readAttribute(targetFk))
    .filter((v) => v !== null && v !== undefined);

  if (targetIds.length === 0) return [];

  const rel = (targetModel as any).all().where({ [targetModel.primaryKey]: targetIds });
  return rel.toArray();
}

/**
 * Process dependent associations before destroying a record.
 */
export async function processDependentAssociations(record: Base): Promise<void> {
  const ctor = record.constructor as typeof Base;
  const associations: AssociationDefinition[] = (ctor as any)._associations ?? [];

  for (const assoc of associations) {
    if (!assoc.options.dependent) continue;
    if (assoc.type !== "hasMany" && assoc.type !== "hasOne") continue;

    const dep = assoc.options.dependent;

    if (assoc.type === "hasMany") {
      const children = await loadHasMany(record, assoc.name, assoc.options);
      if (dep === "destroy") {
        for (const child of children) {
          await child.destroy();
        }
      } else if (dep === "delete") {
        for (const child of children) {
          await child.delete();
        }
      } else if (dep === "nullify") {
        const foreignKey = assoc.options.foreignKey ?? `${underscore(ctor.name)}_id`;
        for (const child of children) {
          await child.updateColumn(foreignKey, null);
        }
      }
    } else if (assoc.type === "hasOne") {
      const child = await loadHasOne(record, assoc.name, assoc.options);
      if (!child) continue;
      if (dep === "destroy") {
        await child.destroy();
      } else if (dep === "delete") {
        await child.delete();
      } else if (dep === "nullify") {
        const foreignKey = assoc.options.foreignKey ?? `${underscore(ctor.name)}_id`;
        await child.updateColumn(foreignKey, null);
      }
    }
  }
}

/**
 * CollectionProxy — wraps a has_many association with convenience methods.
 *
 * Mirrors: ActiveRecord::Associations::CollectionProxy
 */
export class CollectionProxy {
  private _record: Base;
  private _assocName: string;
  private _assocDef: AssociationDefinition;

  constructor(record: Base, assocName: string, assocDef: AssociationDefinition) {
    this._record = record;
    this._assocName = assocName;
    this._assocDef = assocDef;
  }

  /**
   * Load and return all associated records.
   */
  async toArray(): Promise<Base[]> {
    return loadHasMany(this._record, this._assocName, this._assocDef.options);
  }

  /**
   * Build a new associated record (unsaved) with the FK set.
   */
  build(attrs: Record<string, unknown> = {}): Base {
    const ctor = this._record.constructor as typeof Base;
    const className = this._assocDef.options.className ??
      camelize(singularize(this._assocName));
    const foreignKey = this._assocDef.options.foreignKey ?? `${underscore(ctor.name)}_id`;
    const primaryKey = this._assocDef.options.primaryKey ?? ctor.primaryKey;

    const targetModel = resolveModel(className);
    return new targetModel({
      ...attrs,
      [foreignKey]: this._record.readAttribute(primaryKey),
    });
  }

  /**
   * Build and save a new associated record.
   */
  async create(attrs: Record<string, unknown> = {}): Promise<Base> {
    const record = this.build(attrs);
    await record.save();
    return record;
  }

  /**
   * Count associated records.
   */
  async count(): Promise<number> {
    const records = await this.toArray();
    return records.length;
  }
}

/**
 * Factory to get a CollectionProxy for a has_many association.
 */
export function association(record: Base, assocName: string): CollectionProxy {
  const ctor = record.constructor as typeof Base;
  const associations: AssociationDefinition[] = (ctor as any)._associations ?? [];
  const assocDef = associations.find((a) => a.name === assocName);
  if (!assocDef) {
    throw new Error(`Association "${assocName}" not found on ${ctor.name}`);
  }
  return new CollectionProxy(record, assocName, assocDef);
}
