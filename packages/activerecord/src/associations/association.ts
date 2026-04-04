import type { Base } from "../base.js";
import type { AssociationDefinition, AssociationOptions } from "../associations.js";
import { resolveModel, buildHasManyRelation } from "../associations.js";
import { camelize, singularize } from "@blazetrails/activesupport";

/**
 * Base class for all association proxies. An Association wraps a single
 * association between an owner record and its target(s).
 *
 * In Rails, each record lazily creates Association instances via
 * `record.association(:name)`. The instance manages loading, caching,
 * and lifecycle for that association on that specific record.
 *
 * Mirrors: ActiveRecord::Associations::Association
 */
export class Association {
  owner: Base;
  readonly reflection: AssociationDefinition;
  readonly disableJoins: boolean;
  loaded: boolean;
  target: Base | Base[] | null;

  private _staleState: unknown = undefined;
  private _associationScope: unknown = null;

  constructor(owner: Base, reflection: AssociationDefinition) {
    this.owner = owner;
    this.reflection = reflection;
    this.disableJoins = reflection.options.disableJoins || false;
    this.loaded = false;
    this.target = null;
  }

  get name(): string {
    return this.reflection.name;
  }

  get options(): AssociationOptions {
    return this.reflection.options;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  loadedBang(): void {
    this.loaded = true;
    this._staleState = this.staleState();
  }

  isStaleTarget(): boolean {
    return this.loaded && this._staleState !== this.staleState();
  }

  reset(): void {
    this.loaded = false;
    this._staleState = undefined;
  }

  resetNegativeCache(): void {
    if (this.loaded && this.target == null) {
      this.reset();
    }
  }

  reload(): this {
    this.reset();
    this.resetScope();
    this.loadTarget();
    return this;
  }

  setTarget(target: Base | Base[] | null): void {
    this.target = target;
    this.loadedBang();
  }

  /**
   * Returns the scope (Relation) for this association. Subclasses
   * override to provide type-specific scoping. The base implementation
   * delegates to buildHasManyRelation / target model scoping.
   */
  scope(): any {
    return buildHasManyRelation(this.owner, this.reflection.name, this.reflection.options);
  }

  resetScope(): void {
    this._associationScope = null;
  }

  /**
   * Apply strict loading settings from the owner to a loaded record.
   */
  setStrictLoading(record: Base): Base {
    const ownerAny = this.owner as any;
    const recordAny = record as any;
    if (typeof recordAny.strictLoadingBang === "function") {
      if (
        typeof ownerAny.isStrictLoadingNPlusOneOnly === "function" &&
        ownerAny.isStrictLoadingNPlusOneOnly() &&
        this.reflection.type === "hasMany"
      ) {
        recordAny.strictLoadingBang();
      } else if (ownerAny._strictLoading) {
        recordAny.strictLoadingBang(false);
      }
    }
    return record;
  }

  /**
   * Set the inverse association on the given record, so that
   * `record.association(inverse_name).target` points back to owner.
   */
  setInverseInstance(record: Base): Base {
    const inverse = this.inverseAssociationFor(record);
    if (inverse) {
      inverse.inversedFrom(this.owner);
    }
    return record;
  }

  setInverseInstanceFromQueries(record: Base): Base {
    const inverse = this.inverseAssociationFor(record);
    if (inverse) {
      inverse.inversedFromQueries(this.owner);
    }
    return record;
  }

  removeInverseInstance(record: Base): void {
    const inverse = this.inverseAssociationFor(record);
    if (inverse) {
      inverse.inversedFrom(null as any);
    }
  }

  inversedFrom(record: Base | null): void {
    this.target = record;
    if (record !== null) {
      this.loadedBang();
    }
  }

  inversedFromQueries(record: Base | null): void {
    if (this.inversable(record)) {
      this.target = record;
      if (record !== null) {
        this.loadedBang();
      }
    }
  }

  /**
   * Returns the class of the target. belongs_to polymorphic overrides
   * this to look at the polymorphic_type field on the owner.
   */
  get klass(): typeof Base {
    const className =
      this.reflection.options.className ?? camelize(singularize(this.reflection.name));
    return resolveModel(className);
  }

  get extensions(): any[] {
    const ext = this.reflection.options.extend;
    if (!ext) return [];
    return Array.isArray(ext) ? ext : [ext];
  }

  /**
   * Loads the target if needed and returns it. Uses the async load
   * functions from associations.ts and awaits them synchronously
   * via the target cache. If already loaded, returns cached target.
   */
  loadTarget(): Base | Base[] | null {
    if (this.isStaleTarget() || this.findTargetNeeded()) {
      const result = this.doFindTarget();
      if (result !== undefined) {
        this.target = result;
      }
    }

    if (!this.loaded) {
      this.loadedBang();
    }
    return this.target;
  }

  async asyncLoadTarget(): Promise<void> {
    if (this.findTargetNeeded()) {
      const result = await this.doAsyncFindTarget();
      if (result !== undefined) {
        this.target = result;
      }
    }

    if (!this.loaded) {
      this.loadedBang();
    }
  }

  marshalDump(): [string, Record<string, unknown>] {
    return [
      this.reflection.name,
      {
        loaded: this.loaded,
        target: this.target,
      },
    ];
  }

  marshalLoad(data: [string, Record<string, unknown>]): void {
    const [, ivars] = data;
    this.loaded = ivars.loaded as boolean;
    this.target = ivars.target as Base | Base[] | null;
  }

  /**
   * Initialize attributes on a newly built record from the association
   * scope (e.g. set the FK on a has_many child).
   */
  initializeAttributes(record: Base, _exceptFromScopeAttributes?: Record<string, unknown>): void {
    this.setInverseInstance(record);
  }

  async create(attributes?: Record<string, unknown>): Promise<Base | null> {
    return this._createRecord(attributes, false);
  }

  async createBang(attributes?: Record<string, unknown>): Promise<Base> {
    const record = await this._createRecord(attributes, true);
    if (!record) {
      throw new Error("Failed to create associated record");
    }
    return record;
  }

  isCollection(): boolean {
    return false;
  }

  get reader(): Base | Base[] | null {
    return this.target;
  }

  // --- Protected / hook methods for subclasses ---

  protected staleState(): unknown {
    return undefined;
  }

  /**
   * Synchronous find — checks caches and preloaded data. Returns
   * undefined if no cached data is available (caller should use async).
   */
  protected doFindTarget(): Base | Base[] | null | undefined {
    const ownerAny = this.owner as any;
    const name = this.reflection.name;

    if (ownerAny._cachedAssociations?.has(name)) {
      return ownerAny._cachedAssociations.get(name);
    }
    if (ownerAny._preloadedAssociations?.has(name)) {
      return ownerAny._preloadedAssociations.get(name);
    }
    return undefined;
  }

  /**
   * Async find — delegates to the actual load functions in associations.ts.
   * Subclasses override to call the appropriate load function.
   */
  protected async doAsyncFindTarget(): Promise<Base | Base[] | null> {
    return null;
  }

  protected findTargetNeeded(): boolean {
    if (this.loaded) return false;
    const ownerAny = this.owner as any;
    const isNewRecord =
      typeof ownerAny.isNewRecord === "function" ? ownerAny.isNewRecord() : !ownerAny._persisted;
    return !isNewRecord || this.foreignKeyPresent();
  }

  protected foreignKeyPresent(): boolean {
    return false;
  }

  protected async _createRecord(
    attributes?: Record<string, unknown>,
    shouldRaise = false,
  ): Promise<Base | null> {
    const record = this.buildRecord(attributes);
    if (!record) return null;
    if (typeof (record as any).save === "function") {
      const saved = await (record as any).save();
      if (!saved && shouldRaise) {
        throw new Error(`Failed to save the new associated ${this.reflection.name}.`);
      }
    }
    return record;
  }

  protected buildRecord(attributes?: Record<string, unknown>): Base | null {
    const Klass = this.klass;
    if (!Klass) return null;
    const record = new (Klass as any)(attributes ?? {});
    this.initializeAttributes(record, attributes);
    return record;
  }

  private inverseAssociationFor(record: Base): Association | null {
    const inverseOf = this.reflection.options.inverseOf;
    if (!inverseOf) return null;
    const recordAny = record as any;
    if (typeof recordAny.association === "function") {
      try {
        return recordAny.association(inverseOf);
      } catch {
        return null;
      }
    }
    return null;
  }

  private inversable(record: Base | null): boolean {
    if (!record) return false;
    const recordAny = record as any;
    const ownerAny = this.owner as any;
    const recordPersisted = recordAny._persisted ?? false;
    const ownerPersisted = ownerAny._persisted ?? false;
    return !recordPersisted || !ownerPersisted;
  }
}
