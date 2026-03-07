import type { Base } from "./base.js";
import { StrictLoadingViolationError, DeleteRestrictionError } from "./errors.js";
import { underscore, singularize, pluralize, camelize } from "@rails-ts/activesupport";

/**
 * Association options.
 */
export interface AssociationOptions {
  foreignKey?: string;
  className?: string;
  primaryKey?: string;
  dependent?: "destroy" | "nullify" | "delete" | "restrictWithException" | "restrictWithError";
  inverseOf?: string;
  through?: string;
  source?: string;
  polymorphic?: boolean;
  as?: string;
  counterCache?: boolean | string;
  touch?: boolean;
  autosave?: boolean;
  scope?: (rel: any) => any;
  required?: boolean;
  optional?: boolean;
  beforeAdd?: ((owner: Base, record: Base) => void) | ((owner: Base, record: Base) => void)[];
  afterAdd?: ((owner: Base, record: Base) => void) | ((owner: Base, record: Base) => void)[];
  beforeRemove?: ((owner: Base, record: Base) => void) | ((owner: Base, record: Base) => void)[];
  afterRemove?: ((owner: Base, record: Base) => void) | ((owner: Base, record: Base) => void)[];
}

export interface AssociationDefinition {
  type: "belongsTo" | "hasOne" | "hasMany" | "hasAndBelongsToMany";
  name: string;
  options: AssociationOptions & { joinTable?: string };
}

/**
 * Registry to hold model classes by name. Models must be registered
 * here so associations can resolve class references.
 */
export const modelRegistry = new Map<string, typeof Base>();

/**
 * Register a model class for association resolution.
 * Can be called as registerModel(Model) or registerModel("Name", Model).
 */
export function registerModel(nameOrModel: string | typeof Base, model?: typeof Base): void {
  if (typeof nameOrModel === "string") {
    if (!model) throw new Error("registerModel(name, model) requires a model class");
    modelRegistry.set(nameOrModel, model);
  } else {
    modelRegistry.set(nameOrModel.name, nameOrModel);
  }
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
      this._associations = [...(this._associations ?? [])];
    }
    this._associations.push({ type: "belongsTo", name, options });

    // If required: true (or optional: false), add presence validation on the FK
    if (options.required || options.optional === false) {
      const foreignKey = options.foreignKey ?? `${underscore(name)}_id`;
      (this as any).validates(foreignKey, { presence: true });
    }
  }

  /**
   * Define a has_one association.
   *
   * Mirrors: ActiveRecord::Associations::ClassMethods#has_one
   */
  static hasOne(name: string, options: AssociationOptions = {}): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_associations")) {
      this._associations = [...(this._associations ?? [])];
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
      this._associations = [...(this._associations ?? [])];
    }
    this._associations.push({ type: "hasMany", name, options });
  }

  /**
   * Define a has_and_belongs_to_many association.
   *
   * Mirrors: ActiveRecord::Associations::ClassMethods#has_and_belongs_to_many
   */
  static hasAndBelongsToMany(
    name: string,
    options: AssociationOptions & { joinTable?: string } = {}
  ): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_associations")) {
      this._associations = [...(this._associations ?? [])];
    }
    this._associations.push({ type: "hasAndBelongsToMany", name, options });
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
  // Check cached (inverse_of) first, then preloaded
  if ((record as any)._cachedAssociations?.has(assocName)) {
    return (record as any)._cachedAssociations.get(assocName) as Base | null;
  }
  if ((record as any)._preloadedAssociations?.has(assocName)) {
    return (record as any)._preloadedAssociations.get(assocName) as Base | null;
  }

  // Strict loading check: this is a lazy load
  if ((record as any)._strictLoading) {
    throw new StrictLoadingViolationError(record, assocName);
  }

  const foreignKey = options.foreignKey ?? `${underscore(assocName)}_id`;
  const primaryKey = options.primaryKey ?? "id";

  // Polymorphic: use the _type column to determine the target model
  let className: string;
  if (options.polymorphic) {
    const typeCol = `${underscore(assocName)}_type`;
    const typeName = record.readAttribute(typeCol) as string | null;
    if (!typeName) return null;
    className = typeName;
  } else {
    className = options.className ?? camelize(assocName);
  }

  const targetModel = resolveModel(className);
  const fkValue = record.readAttribute(foreignKey);
  if (fkValue === null || fkValue === undefined) return null;

  const result = await targetModel.findBy({ [primaryKey]: fkValue });

  // Set inverse_of: store reference back to the owner
  if (result && options.inverseOf) {
    (result as any)._cachedAssociations = (result as any)._cachedAssociations ?? new Map();
    (result as any)._cachedAssociations.set(options.inverseOf, record);
  }

  return result;
}

/**
 * Load a has_one association.
 */
export async function loadHasOne(
  record: Base,
  assocName: string,
  options: AssociationOptions
): Promise<Base | null> {
  // Check cached (inverse_of) first, then preloaded
  if ((record as any)._cachedAssociations?.has(assocName)) {
    return (record as any)._cachedAssociations.get(assocName) as Base | null;
  }
  if ((record as any)._preloadedAssociations?.has(assocName)) {
    return (record as any)._preloadedAssociations.get(assocName) as Base | null;
  }

  // Strict loading check
  if ((record as any)._strictLoading) {
    throw new StrictLoadingViolationError(record, assocName);
  }

  const ctor = record.constructor as typeof Base;
  const className = options.className ?? camelize(assocName);
  const primaryKey = options.primaryKey ?? ctor.primaryKey;

  const targetModel = resolveModel(className);
  const pkValue = record.readAttribute(primaryKey);
  if (pkValue === null || pkValue === undefined) return null;

  // Polymorphic "as" option: has_one :image, as: :imageable
  if (options.as) {
    const foreignKey = options.foreignKey ?? `${underscore(options.as)}_id`;
    const typeCol = `${underscore(options.as)}_type`;
    return targetModel.findBy({
      [foreignKey]: pkValue,
      [typeCol]: ctor.name,
    });
  }

  const foreignKey = options.foreignKey ?? `${underscore(ctor.name)}_id`;
  let result: Base | null;
  if (options.scope) {
    let rel = (targetModel as any).all().where({ [foreignKey]: pkValue });
    rel = options.scope(rel);
    result = await rel.first();
  } else {
    result = await targetModel.findBy({ [foreignKey]: pkValue });
  }

  // Set inverse_of: store reference back to the owner
  if (result && options.inverseOf) {
    (result as any)._cachedAssociations = (result as any)._cachedAssociations ?? new Map();
    (result as any)._cachedAssociations.set(options.inverseOf, record);
  }

  return result;
}

/**
 * Load a has_many association.
 */
export async function loadHasMany(
  record: Base,
  assocName: string,
  options: AssociationOptions
): Promise<Base[]> {
  // Check cached (inverse_of) first, then preloaded
  if ((record as any)._cachedAssociations?.has(assocName)) {
    return (record as any)._cachedAssociations.get(assocName) as Base[];
  }
  if ((record as any)._preloadedAssociations?.has(assocName)) {
    return (record as any)._preloadedAssociations.get(assocName) as Base[];
  }

  // Strict loading check
  if ((record as any)._strictLoading) {
    throw new StrictLoadingViolationError(record, assocName);
  }

  // Handle through associations
  if (options.through) {
    return loadHasManyThrough(record, assocName, options);
  }

  const ctor = record.constructor as typeof Base;
  const className =
    options.className ?? camelize(singularize(assocName));
  const primaryKey = options.primaryKey ?? ctor.primaryKey;

  const targetModel = resolveModel(className);
  const pkValue = record.readAttribute(primaryKey);
  if (pkValue === null || pkValue === undefined) return [];

  // Polymorphic "as" option: has_many :comments, as: :commentable
  if (options.as) {
    const foreignKey = options.foreignKey ?? `${underscore(options.as)}_id`;
    const typeCol = `${underscore(options.as)}_type`;
    const rel = (targetModel as any).all().where({
      [foreignKey]: pkValue,
      [typeCol]: ctor.name,
    });
    return rel.toArray();
  }

  const foreignKey = options.foreignKey ?? `${underscore(ctor.name)}_id`;
  let rel = (targetModel as any).all().where({ [foreignKey]: pkValue });
  // Apply association scope
  if (options.scope) {
    rel = options.scope(rel);
  }
  const results: Base[] = await rel.toArray();

  // Set inverse_of on each loaded child
  if (options.inverseOf) {
    for (const child of results) {
      (child as any)._cachedAssociations = (child as any)._cachedAssociations ?? new Map();
      (child as any)._cachedAssociations.set(options.inverseOf, record);
    }
  }

  return results;
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
 * Compute the default join table name for HABTM.
 * Uses the two table names in alphabetical order, joined by underscore.
 */
function defaultJoinTableName(model1: typeof Base, assocName: string): string {
  const table1 = underscore(model1.name);
  const table2 = underscore(assocName);
  // Sort alphabetically
  const sorted = [pluralize(table1), table2].sort();
  return sorted.join("_");
}

/**
 * Load a has_and_belongs_to_many association.
 */
export async function loadHabtm(
  record: Base,
  assocName: string,
  options: AssociationOptions & { joinTable?: string }
): Promise<Base[]> {
  // Check preloaded cache first
  if ((record as any)._preloadedAssociations?.has(assocName)) {
    return (record as any)._preloadedAssociations.get(assocName) as Base[];
  }

  const ctor = record.constructor as typeof Base;
  const className = options.className ?? camelize(singularize(assocName));
  const targetModel = resolveModel(className);
  const joinTable = options.joinTable ?? defaultJoinTableName(ctor, assocName);
  const ownerFk = `${underscore(ctor.name)}_id`;
  const targetFk = `${underscore(singularize(assocName))}_id`;
  const pkValue = record.readAttribute(ctor.primaryKey);
  if (pkValue === null || pkValue === undefined) return [];

  // Query the join table to get target IDs
  const pkQuoted = typeof pkValue === "number" ? String(pkValue) : `'${pkValue}'`;
  const joinRows = await ctor.adapter.execute(
    `SELECT "${targetFk}" FROM "${joinTable}" WHERE "${ownerFk}" = ${pkQuoted}`
  );

  const targetIds = joinRows.map((r) => r[targetFk]).filter((v) => v != null);
  if (targetIds.length === 0) return [];

  return (targetModel as any).all().where({ [targetModel.primaryKey]: targetIds }).toArray();
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
      } else if (dep === "restrictWithException") {
        if (children.length > 0) {
          throw new DeleteRestrictionError(record, assoc.name);
        }
      } else if (dep === "restrictWithError") {
        if (children.length > 0) {
          (record as any).errors?.add("base", "invalid", { message: `Cannot delete record because dependent ${assoc.name} exist` });
          throw new DeleteRestrictionError(record, assoc.name);
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
      } else if (dep === "restrictWithException") {
        throw new DeleteRestrictionError(record, assoc.name);
      } else if (dep === "restrictWithError") {
        (record as any).errors?.add("base", "invalid", { message: `Cannot delete record because dependent ${assoc.name} exists` });
        throw new DeleteRestrictionError(record, assoc.name);
      }
    }
  }
}

/**
 * Fire one or more association callbacks (before_add, after_add, etc.).
 */
function fireAssocCallbacks(
  cbs: ((owner: Base, record: Base) => void) | ((owner: Base, record: Base) => void)[] | undefined,
  owner: Base,
  record: Base
): void {
  if (!cbs) return;
  const arr = Array.isArray(cbs) ? cbs : [cbs];
  for (const cb of arr) cb(owner, record);
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

  /**
   * Alias for count.
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#size
   */
  async size(): Promise<number> {
    return this.count();
  }

  /**
   * Check if the collection is empty.
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#empty?
   */
  async isEmpty(): Promise<boolean> {
    return (await this.count()) === 0;
  }

  /**
   * Add one or more records to the collection by setting the FK and saving.
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#push / #<<
   */
  async push(...records: Base[]): Promise<void> {
    const ctor = this._record.constructor as typeof Base;
    const foreignKey = this._assocDef.options.foreignKey ?? `${underscore(ctor.name)}_id`;
    const primaryKey = this._assocDef.options.primaryKey ?? ctor.primaryKey;
    const pkValue = this._record.readAttribute(primaryKey);
    for (const record of records) {
      fireAssocCallbacks(this._assocDef.options.beforeAdd, this._record, record);
      record.writeAttribute(foreignKey, pkValue);
      await record.save();
      fireAssocCallbacks(this._assocDef.options.afterAdd, this._record, record);
    }
  }

  /**
   * Alias for push.
   */
  async concat(...records: Base[]): Promise<void> {
    return this.push(...records);
  }

  /**
   * Delete associated records by nullifying the FK.
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#delete
   */
  async delete(...records: Base[]): Promise<void> {
    const ctor = this._record.constructor as typeof Base;
    const foreignKey = this._assocDef.options.foreignKey ?? `${underscore(ctor.name)}_id`;
    for (const record of records) {
      fireAssocCallbacks(this._assocDef.options.beforeRemove, this._record, record);
      record.writeAttribute(foreignKey, null);
      await record.save();
      fireAssocCallbacks(this._assocDef.options.afterRemove, this._record, record);
    }
  }

  /**
   * Destroy associated records (runs callbacks and deletes from DB).
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#destroy
   */
  async destroy(...records: Base[]): Promise<void> {
    for (const record of records) {
      await record.destroy();
    }
  }

  /**
   * Remove all records from the collection by nullifying FKs.
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#clear
   */
  async clear(): Promise<void> {
    const records = await this.toArray();
    await this.delete(...records);
  }

  /**
   * Check if a record is in the collection.
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#include?
   */
  async includes(record: Base): Promise<boolean> {
    const records = await this.toArray();
    const pk = (record.constructor as typeof Base).primaryKey;
    const targetId = record.readAttribute(pk);
    return records.some(r => r.readAttribute(pk) === targetId);
  }

  /**
   * Return the first associated record.
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#first
   */
  async first(): Promise<Base | null> {
    const records = await this.toArray();
    return records[0] ?? null;
  }

  /**
   * Return the last associated record.
   *
   * Mirrors: ActiveRecord::Associations::CollectionProxy#last
   */
  async last(): Promise<Base | null> {
    const records = await this.toArray();
    return records[records.length - 1] ?? null;
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

/**
 * Update counter caches after a record is created or destroyed.
 *
 * Mirrors: ActiveRecord::CounterCache
 */
export async function updateCounterCaches(
  record: Base,
  direction: "increment" | "decrement"
): Promise<void> {
  const ctor = record.constructor as typeof Base;
  const associations: AssociationDefinition[] = (ctor as any)._associations ?? [];

  for (const assoc of associations) {
    if (assoc.type !== "belongsTo" || !assoc.options.counterCache) continue;

    const foreignKey = assoc.options.foreignKey ?? `${underscore(assoc.name)}_id`;
    const fkValue = record.readAttribute(foreignKey);
    if (fkValue === null || fkValue === undefined) continue;

    const className = assoc.options.className ?? camelize(assoc.name);
    const targetModel = resolveModel(className);

    // Counter column name
    const counterCol =
      typeof assoc.options.counterCache === "string"
        ? assoc.options.counterCache
        : `${pluralize(underscore(ctor.name))}_count`;

    const parent = await targetModel.findBy({ [targetModel.primaryKey]: fkValue });
    if (!parent) continue;

    if (direction === "increment") {
      await parent.incrementBang(counterCol);
    } else {
      await parent.decrementBang(counterCol);
    }
  }
}

/**
 * Touch parent associations after a record is saved or destroyed.
 *
 * Mirrors: ActiveRecord::Associations::Builder::BelongsTo touch option
 */
export async function touchBelongsToParents(record: Base): Promise<void> {
  const ctor = record.constructor as typeof Base;
  const associations: AssociationDefinition[] = (ctor as any)._associations ?? [];

  for (const assoc of associations) {
    if (assoc.type !== "belongsTo" || !assoc.options.touch) continue;

    const foreignKey = assoc.options.foreignKey ?? `${underscore(assoc.name)}_id`;
    const fkValue = record.readAttribute(foreignKey);
    if (fkValue === null || fkValue === undefined) continue;

    const className = assoc.options.className ?? camelize(assoc.name);
    const targetModel = resolveModel(className);

    const parent = await targetModel.findBy({ [targetModel.primaryKey]: fkValue });
    if (!parent) continue;

    await parent.touch();
  }
}
