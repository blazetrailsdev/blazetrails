import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { Association } from "./association.js";

/**
 * Base class for has_many and has_and_belongs_to_many associations.
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

  writer(records: Base[]): void {
    this.replace(records);
  }

  idsReader(): unknown[] {
    if (this.isLoaded()) {
      return this.target.map((r: any) => r.id);
    } else if (this.target.length > 0) {
      this.loadTarget();
      return this.target.map((r: any) => r.id);
    } else {
      if (this._associationIds) return this._associationIds;
      this._associationIds = this.target.map((r: any) => r.id);
      return this._associationIds;
    }
  }

  idsWriter(ids: unknown[]): void {
    const Klass = this.klass as any;
    const filteredIds = (ids ?? []).filter((id) => id != null && id !== "");
    if (filteredIds.length === 0) {
      this.replace([]);
      return;
    }
    const records = filteredIds
      .map((id) => {
        const record = Klass.find?.(id);
        return record;
      })
      .filter(Boolean);
    this.replace(records);
  }

  override reset(): void {
    super.reset();
    this.target = [];
    this._replacedOrAddedTargets = new Set();
    this._associationIds = null;
  }

  find(...args: unknown[]): Base | Base[] | null {
    const ids = (args as any[]).flat().filter(Boolean);
    if (this.reflection.options.inverseOf && this.isLoaded()) {
      if (ids.length === 0) {
        throw new Error(`Couldn't find ${this.klass.name} without an ID`);
      }
      return this.findByScan(ids);
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

  concat(...records: Base[]): Base[] {
    const flattened = records.flat() as Base[];
    for (const record of flattened) {
      this.addToTarget(record);
    }
    return flattened;
  }

  deleteAll(dependent?: string): void {
    if (dependent && dependent !== "nullify" && dependent !== "deleteAll") {
      throw new Error("Valid values are 'nullify' or 'deleteAll'");
    }
    this.target = [];
    this.reset();
    this.loadedBang();
  }

  destroyAll(): void {
    const records = this.loadTarget() as Base[];
    if (records) {
      for (const record of records) {
        if (typeof (record as any).destroy === "function") {
          (record as any).destroy();
        }
      }
    }
    this.reset();
    this.loadedBang();
  }

  delete(...records: Base[]): void {
    this.deleteOrDestroy(records.flat(), this.reflection.options.dependent);
  }

  destroy(...records: Base[]): void {
    this.deleteOrDestroy(records.flat(), "destroy");
  }

  get size(): number {
    if (this.isLoaded()) {
      return this.target.length;
    }
    return this.target.length;
  }

  isEmpty(): boolean {
    if (this.isLoaded()) {
      return this.size === 0;
    }
    return this.target.length === 0;
  }

  replace(otherArray: Base[]): void {
    this.target = [...otherArray];
    this.loadedBang();
  }

  isInclude(record: Base): boolean {
    if ((record as any).isNewRecord?.()) {
      return this.target.includes(record);
    }
    if (this.isLoaded()) {
      return this.target.includes(record);
    }
    return this.target.some((r: any) => r.id === (record as any).id);
  }

  override loadTarget(): Base[] {
    if (!this.isLoaded()) {
      this.loadedBang();
    }
    return this.target;
  }

  addToTarget(record: Base, options: { skipCallbacks?: boolean; replace?: boolean } = {}): Base {
    const { replace: shouldReplace } = options;
    if (shouldReplace) {
      const index = this.target.indexOf(record);
      if (index !== -1) {
        this.target[index] = record;
        return record;
      }
    }

    this.setInverseInstance(record);
    this._replacedOrAddedTargets.add(record);
    this._associationIds = null;
    this.target.push(record);
    return record;
  }

  override scope(): any {
    const s = super.scope();
    if (this.isNullScope()) {
      return null;
    }
    return s;
  }

  isNullScope(): boolean {
    const ownerAny = this.owner as any;
    const isNewRecord =
      typeof ownerAny.isNewRecord === "function"
        ? ownerAny.isNewRecord()
        : (ownerAny.newRecord ?? false);
    return isNewRecord;
  }

  isFindFromTarget(): boolean {
    return (
      this.isLoaded() ||
      (this.owner as any).isNewRecord?.() ||
      this.target.some(
        (r: any) =>
          (typeof r.isNewRecord === "function" ? r.isNewRecord() : false) ||
          (typeof r.isChanged === "function" ? r.isChanged() : false),
      )
    );
  }

  override isCollection(): boolean {
    return true;
  }

  get reader(): Base[] {
    return this.target;
  }

  private deleteOrDestroy(records: Base[], method?: string): void {
    if (records.length === 0) return;
    for (const record of records) {
      const idx = this.target.indexOf(record);
      if (idx !== -1) {
        this.target.splice(idx, 1);
      }
    }
    this._associationIds = null;
    if (method === "destroy") {
      for (const record of records) {
        if (typeof (record as any).destroy === "function") {
          (record as any).destroy();
        }
      }
    }
  }

  private findByScan(ids: unknown[]): Base | Base[] {
    const stringIds = ids.map(String);
    if (stringIds.length === 1) {
      const found = this.target.find((r: any) => String(r.id) === stringIds[0]);
      return found ?? null!;
    }
    return this.target.filter((r: any) => stringIds.includes(String(r.id)));
  }
}
