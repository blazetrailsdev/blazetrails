import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { fireAssocCallbacks } from "../associations.js";
import { Association } from "./association.js";

/**
 * Base class for has_many and has_and_belongs_to_many associations.
 *
 * CollectionAssociation provides common CRUD methods for collections.
 * The actual database interaction is delegated to load functions in
 * associations.ts and the CollectionProxy class.
 *
 * Mirrors: ActiveRecord::Associations::CollectionAssociation
 */
export class CollectionAssociation extends Association {
  declare target: Base[];
  nestedAttributesTarget: Base[] | null = null;
  private _replacedOrAddedTargets: Set<Base> = new Set();
  private _associationIds: unknown[] | null = null;

  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
    this.target = [];
  }

  /**
   * Implements the writer method, e.g. foo.items= for Foo.has_many :items.
   * Replaces the entire collection.
   */
  writer(records: Base[]): void {
    this.replace(records);
  }

  /**
   * Implements the ids reader, e.g. foo.item_ids.
   * Returns an array of primary key values from the target.
   */
  idsReader(): unknown[] {
    if (this.isLoaded()) {
      return this.target.map((r: any) => r.id);
    }
    if (this.target.length > 0) {
      this.loadTarget();
      return this.target.map((r: any) => r.id);
    }
    if (this._associationIds) return this._associationIds;
    // If not loaded and empty, defer to scope
    const rel = this.scope();
    if (rel && typeof rel.pluck === "function") {
      return rel.pluck("id");
    }
    return [];
  }

  /**
   * Implements the ids writer, e.g. foo.item_ids=.
   * Loads records by the given IDs and replaces the collection.
   */
  async idsWriter(ids: unknown[]): Promise<void> {
    const filteredIds = (ids ?? []).filter((id) => id != null && id !== "");
    if (filteredIds.length === 0) {
      this.replace([]);
      return;
    }
    const Klass = this.klass as any;
    if (typeof Klass.where === "function") {
      const pk = Klass.primaryKey ?? "id";
      const records: Base[] = await Klass.where({ [pk]: filteredIds }).toArray();
      this.replace(records);
    }
  }

  override reset(): void {
    super.reset();
    this.target = [];
    this._replacedOrAddedTargets = new Set();
    this._associationIds = null;
  }

  /**
   * Find records within the association. If inverse_of is set and the
   * collection is loaded, scans the in-memory target. Otherwise
   * delegates to the association scope.
   */
  find(...args: unknown[]): Base | Base[] | null {
    const ids = (args as any[]).flat().filter(Boolean);

    if (this.reflection.options.inverseOf && this.isLoaded()) {
      if (ids.length === 0) {
        throw new Error(`Couldn't find ${this.klass.name} without an ID`);
      }
      return this.findByScan(ids);
    }

    // Delegate to scope
    const rel = this.scope();
    if (rel && typeof rel.find === "function") {
      return rel.find(...ids);
    }
    return null;
  }

  build(attributes?: Record<string, unknown>): Base {
    const record = this.buildRecord(attributes);
    if (record) {
      this.addToTarget(record, { replace: true });
    }
    return record!;
  }

  /**
   * Add records to this association. Flattens arguments and inserts
   * each record, persisting if the owner is persisted.
   */
  async concat(...records: Base[]): Promise<Base[]> {
    const flattened = records.flat() as Base[];
    for (const record of flattened) {
      this.addToTarget(record);
      if ((this.owner as any)._persisted && typeof (record as any).save === "function") {
        this.setOwnerAttributes(record);
        await (record as any).save();
      }
    }
    return flattened;
  }

  /**
   * Removes all records from the association. Honors the :dependent
   * option. If :dependent is :destroy, uses :delete_all strategy instead.
   */
  async deleteAll(dependent?: string): Promise<void> {
    if (dependent && dependent !== "nullify" && dependent !== "deleteAll") {
      throw new Error("Valid values are 'nullify' or 'deleteAll'");
    }

    const effectiveDependent =
      dependent ?? (this.options.dependent === "destroy" ? "deleteAll" : this.options.dependent);

    if (effectiveDependent === "nullify") {
      await this.nullifyAllRecords();
    } else {
      await this.deleteAllRecords();
    }

    this.reset();
    this.loadedBang();
  }

  /**
   * Destroy all records from this association, calling destroy callbacks.
   */
  async destroyAll(): Promise<void> {
    const records = this.loadTarget() as Base[];
    for (const record of records) {
      if (typeof (record as any).destroy === "function") {
        await (record as any).destroy();
      }
    }
    this.reset();
    this.loadedBang();
  }

  /**
   * Remove specific records from the association using the :dependent
   * strategy. Calls before_remove/after_remove callbacks.
   */
  delete(...records: Base[]): void {
    this.deleteOrDestroy(records.flat(), this.reflection.options.dependent);
  }

  /**
   * Destroy specific records, ignoring the :dependent option.
   * Calls before_remove/after_remove + before_destroy/after_destroy callbacks.
   */
  destroy(...records: Base[]): void {
    this.deleteOrDestroy(records.flat(), "destroy");
  }

  get size(): number {
    if (this.isLoaded()) {
      return this.target.length;
    }
    if (this._associationIds) {
      return this._associationIds.length;
    }
    if (this.target.length > 0) {
      // Unsaved + count
      const unsaved = this.target.filter(
        (r: any) => typeof r.isNewRecord === "function" && r.isNewRecord(),
      );
      return unsaved.length + this.countRecords();
    }
    return this.countRecords();
  }

  isEmpty(): boolean {
    if (this.isLoaded() || this._associationIds) {
      return this.size === 0;
    }
    return this.target.length === 0;
  }

  /**
   * Replace this collection with other_array. Performs a diff and
   * delete/add only records that have changed.
   */
  replace(otherArray: Base[]): void {
    const original = [...this.target];
    const toRemove = original.filter((r) => !otherArray.includes(r));
    const toAdd = otherArray.filter((r) => !original.includes(r));

    for (const record of toRemove) {
      fireAssocCallbacks(this.options.beforeRemove, this.owner, record);
      const idx = this.target.indexOf(record);
      if (idx !== -1) this.target.splice(idx, 1);
      fireAssocCallbacks(this.options.afterRemove, this.owner, record);
    }

    for (const record of toAdd) {
      this.addToTarget(record);
    }

    this.loadedBang();
  }

  /**
   * Check if a record is in the collection. For new records, checks
   * the in-memory target. For persisted records, uses scope if not loaded.
   */
  isInclude(record: Base): boolean {
    const recordAny = record as any;
    const isNew =
      typeof recordAny.isNewRecord === "function" ? recordAny.isNewRecord() : !recordAny._persisted;

    if (isNew) {
      return this.target.includes(record);
    }
    if (this.isLoaded()) {
      return this.target.includes(record);
    }
    // Check by ID against the scope
    const rel = this.scope();
    if (rel && typeof rel.exists === "function") {
      return rel.exists(recordAny.id);
    }
    return this.target.some((r: any) => r.id === recordAny.id);
  }

  /**
   * Load target from database and merge with in-memory records.
   */
  override loadTarget(): Base[] {
    if (this.findTargetNeeded()) {
      const found = this.doFindTarget();
      if (found !== undefined && Array.isArray(found)) {
        this.target = this.mergeTargetLists(found, this.target);
      }
    }

    this.loadedBang();
    return this.target;
  }

  /**
   * Add a record to the in-memory target array, firing callbacks
   * and setting inverse associations.
   */
  addToTarget(record: Base, options: { skipCallbacks?: boolean; replace?: boolean } = {}): Base {
    const { skipCallbacks, replace: shouldReplace } = options;

    let index = -1;
    if (shouldReplace && this._replacedOrAddedTargets.has(record)) {
      index = this.target.indexOf(record);
    }

    if (!skipCallbacks) {
      const proceed = fireAssocCallbacks(this.reflection.options.beforeAdd, this.owner, record);
      if (proceed === false) return record;
    }

    this.setInverseInstance(record);
    this._replacedOrAddedTargets.add(record);
    this._associationIds = null;

    if (index !== -1) {
      this.target[index] = record;
    } else {
      this.target.push(record);
    }

    if (!skipCallbacks) {
      fireAssocCallbacks(this.reflection.options.afterAdd, this.owner, record);
    }

    return record;
  }

  /**
   * Returns the scope (Relation) for this association, applying
   * none! if the scope is null (owner is new and has no FK).
   */
  override scope(): any {
    const s = super.scope();
    if (this.isNullScope() && s && typeof s.none === "function") {
      return s.none();
    }
    return s;
  }

  /**
   * Returns true if the scope should be null — owner is a new
   * record and has no foreign key present.
   */
  isNullScope(): boolean {
    const ownerAny = this.owner as any;
    const isNewRecord =
      typeof ownerAny.isNewRecord === "function" ? ownerAny.isNewRecord() : !ownerAny._persisted;
    return isNewRecord && !this.foreignKeyPresent();
  }

  /**
   * Returns true if find should search the loaded target rather than
   * going to the database. True when loaded, strict loading, new record,
   * or any target record is new/changed.
   */
  isFindFromTarget(): boolean {
    return (
      this.isLoaded() ||
      (this.owner as any)._strictLoading ||
      !(this.owner as any)._persisted ||
      this.target.some(
        (r: any) =>
          !r._persisted || (typeof r.hasChangesToSave === "function" && r.hasChangesToSave()),
      )
    );
  }

  override isCollection(): boolean {
    return true;
  }

  get reader(): Base[] {
    return this.target;
  }

  // --- Private helpers ---

  protected setOwnerAttributes(record: Base): void {
    const ownerAny = this.owner as any;
    const ctor = ownerAny.constructor;
    const fk =
      this.reflection.options.foreignKey ??
      `${(ctor.name as string).charAt(0).toLowerCase() + (ctor.name as string).slice(1)}Id`;

    if (typeof fk === "string") {
      (record as any)[fk] = ownerAny.id;
    }

    if (this.reflection.options.as) {
      const typeCol = `${this.reflection.options.as}Type`;
      (record as any)[typeCol] = ctor.name;
    }
  }

  private countRecords(): number {
    const rel = this.scope();
    if (rel && typeof rel.count === "function") {
      // This is synchronous for in-memory adapters, async for real DB.
      // Return 0 as a safe default if we can't count synchronously.
      const result = rel.count();
      if (typeof result === "number") return result;
    }
    return 0;
  }

  private deleteOrDestroy(records: Base[], method?: string): void {
    if (records.length === 0) return;

    for (const record of records) {
      fireAssocCallbacks(this.options.beforeRemove, this.owner, record);
    }

    if (method === "destroy") {
      for (const record of records) {
        if (typeof (record as any).destroy === "function") {
          (record as any).destroy();
        }
      }
    }

    for (const record of records) {
      const idx = this.target.indexOf(record);
      if (idx !== -1) {
        this.target.splice(idx, 1);
      }
    }
    this._associationIds = null;

    for (const record of records) {
      fireAssocCallbacks(this.options.afterRemove, this.owner, record);
    }
  }

  private async nullifyAllRecords(): Promise<void> {
    for (const record of this.target) {
      this.nullifyOwnerAttributes(record);
      if (typeof (record as any).save === "function") {
        await (record as any).save();
      }
    }
  }

  private nullifyOwnerAttributes(record: Base): void {
    const fk = this.reflection.options.foreignKey;
    if (fk && typeof fk === "string") {
      (record as any)[fk] = null;
    }
  }

  private async deleteAllRecords(): Promise<void> {
    const rel = this.scope();
    if (rel && typeof rel.deleteAll === "function") {
      await rel.deleteAll();
    }
  }

  /**
   * Merge persisted records from DB with in-memory target records.
   * Preserves order of persisted, deduplicates, and keeps
   * attribute changes from in-memory versions.
   */
  private mergeTargetLists(persisted: Base[], memory: Base[]): Base[] {
    if (memory.length === 0) return persisted;

    const memoryById = new Map<unknown, Base>();
    for (const record of memory) {
      memoryById.set((record as any).id, record);
    }

    const merged = persisted.map((record) => {
      const memRecord = memoryById.get((record as any).id);
      if (memRecord) {
        memoryById.delete((record as any).id);
        return memRecord;
      }
      return record;
    });

    // Add remaining in-memory records that weren't in persisted (new records)
    for (const record of memoryById.values()) {
      const isNew =
        typeof (record as any).isNewRecord === "function"
          ? (record as any).isNewRecord()
          : !(record as any)._persisted;
      if (isNew) {
        merged.push(record);
      }
    }

    return merged;
  }

  private findByScan(ids: unknown[]): Base | Base[] {
    const stringIds = ids.map(String);
    if (stringIds.length === 1) {
      const found = this.target.find((r: any) => String(r.id) === stringIds[0]);
      return found ?? (null as any);
    }
    return this.target.filter((r: any) => stringIds.includes(String(r.id)));
  }
}
