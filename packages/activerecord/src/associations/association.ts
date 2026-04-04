import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { resolveModel } from "../associations.js";
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
  private _skipStrictLoading: boolean | null = null;

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

  get options(): AssociationDefinition["options"] {
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

  scope(): any {
    return this.targetScope();
  }

  resetScope(): void {
    this._associationScope = null;
  }

  setStrictLoading(record: Base): void {
    const ownerAny = this.owner as any;
    if (
      typeof ownerAny.isStrictLoadingNPlusOneOnly === "function" &&
      ownerAny.isStrictLoadingNPlusOneOnly() &&
      this.reflection.type === "hasMany"
    ) {
      if (typeof (record as any).strictLoadingBang === "function") {
        (record as any).strictLoadingBang();
      }
    } else {
      if (typeof (record as any).strictLoadingBang === "function") {
        (record as any).strictLoadingBang(false);
      }
    }
    return record as any;
  }

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

  get klass(): typeof Base {
    const className =
      this.reflection.options.className ?? camelize(singularize(this.reflection.name));
    return resolveModel(className);
  }

  get extensions(): any[] {
    return this.reflection.options.extend
      ? Array.isArray(this.reflection.options.extend)
        ? this.reflection.options.extend
        : [this.reflection.options.extend]
      : [];
  }

  loadTarget(): Base | Base[] | null {
    if (this.findTarget()) {
      this.target = this.doFindTarget();
    }

    if (!this.loaded) {
      this.loadedBang();
    }
    return this.target;
  }

  asyncLoadTarget(): Promise<void> {
    if (this.findTarget()) {
      this.target = this.doFindTarget();
    }

    if (!this.loaded) {
      this.loadedBang();
    }
    return Promise.resolve();
  }

  marshalDump(): [string, Record<string, unknown>] {
    return [
      this.reflection.name,
      {
        owner: (this.owner as any).id,
        loaded: this.loaded,
      },
    ];
  }

  marshalLoad(data: [string, Record<string, unknown>]): void {
    const [, ivars] = data;
    this.loaded = ivars.loaded as boolean;
  }

  initializeAttributes(record: Base, exceptFromScopeAttributes?: Record<string, unknown>): void {
    this.setInverseInstance(record);
  }

  create(attributes?: Record<string, unknown>): Base | null {
    return this.createRecord(attributes, false);
  }

  createBang(attributes?: Record<string, unknown>): Base {
    const record = this.createRecord(attributes, true);
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

  protected staleState(): unknown {
    return undefined;
  }

  protected targetScope(): any {
    return null;
  }

  protected doFindTarget(): Base | Base[] | null {
    return null;
  }

  protected findTarget(): boolean {
    return !this.loaded && !(this.owner as any).isNewRecord?.() && !!this.klass;
  }

  protected createRecord(attributes?: Record<string, unknown>, _raise = false): Base | null {
    return this.buildRecord(attributes);
  }

  protected buildRecord(attributes?: Record<string, unknown>): Base | null {
    const Klass = this.klass;
    if (!Klass) return null;
    const record = new (Klass as any)(attributes ?? {});
    this.initializeAttributes(record);
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
    const recordPersisted =
      typeof recordAny.isPersisted === "function" ? recordAny.isPersisted() : recordAny.persisted;
    const ownerPersisted =
      typeof ownerAny.isPersisted === "function" ? ownerAny.isPersisted() : ownerAny.persisted;
    return !recordPersisted || !ownerPersisted;
  }
}
