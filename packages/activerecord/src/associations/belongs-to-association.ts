import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { underscore } from "@blazetrails/activesupport";
import { SingularAssociation } from "./singular-association.js";

/**
 * Mirrors: ActiveRecord::Associations::BelongsToAssociation
 */
export class BelongsToAssociation extends SingularAssociation {
  private _updated = false;

  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }

  handleDependency(): void {
    if (!this.loadTarget()) return;

    const dependent = this.reflection.options.dependent;
    if (!dependent) return;

    switch (dependent) {
      case "destroy":
        if (this.target && typeof (this.target as any).destroy === "function") {
          (this.target as any).destroy();
        }
        break;
      case "delete":
        if (this.target && typeof (this.target as any).delete === "function") {
          (this.target as any).delete();
        }
        break;
      default:
        if (this.target && typeof (this.target as any)[dependent] === "function") {
          (this.target as any)[dependent]();
        }
    }
  }

  override inversedFrom(record: Base | null): void {
    this.replaceKeys(record);
    super.inversedFrom(record);
  }

  default(block: () => Base | null): void {
    if (this.reader == null) {
      const value = block.call(this.owner);
      if (value != null) {
        this.writer(value);
      }
    }
  }

  override reset(): void {
    super.reset();
    this._updated = false;
  }

  isUpdated(): boolean {
    return this._updated;
  }

  decrementCounters(): void {
    this.updateCounters(-1);
  }

  incrementCounters(): void {
    this.updateCounters(1);
  }

  decrementCountersBeforeLastSave(): void {
    const foreignKey = this.foreignKeyName();
    const ownerAny = this.owner as any;
    const foreignKeyWas =
      typeof ownerAny.attributeBeforeLastSave === "function"
        ? ownerAny.attributeBeforeLastSave(foreignKey)
        : undefined;

    if (foreignKeyWas) {
      this.updateCounters(-1);
    }
  }

  isTargetChanged(): boolean {
    const ownerAny = this.owner as any;
    const fk = this.foreignKeyName();
    const attrChanged =
      typeof ownerAny.attributeChanged === "function"
        ? ownerAny.attributeChanged(fk)
        : typeof ownerAny.isAttributeChanged === "function"
          ? ownerAny.isAttributeChanged(fk)
          : false;
    return (
      attrChanged ||
      (!this.foreignKeyPresent() && this.target != null && (this.target as any).isNewRecord?.())
    );
  }

  isTargetPreviouslyChanged(): boolean {
    const ownerAny = this.owner as any;
    const fk = this.foreignKeyName();
    return typeof ownerAny.attributePreviouslyChanged === "function"
      ? ownerAny.attributePreviouslyChanged(fk)
      : typeof ownerAny.isAttributePreviouslyChanged === "function"
        ? ownerAny.isAttributePreviouslyChanged(fk)
        : false;
  }

  isSavedChangeToTarget(): boolean {
    const ownerAny = this.owner as any;
    const fk = this.foreignKeyName();
    return typeof ownerAny.savedChangeToAttribute === "function"
      ? ownerAny.savedChangeToAttribute(fk)
      : typeof ownerAny.isSavedChangeToAttribute === "function"
        ? ownerAny.isSavedChangeToAttribute(fk)
        : false;
  }

  protected override replace(record: Base | null): void {
    if (record) {
      this.setInverseInstance(record);
      this._updated = true;
    } else if (this.target) {
      this.removeInverseInstance(this.target);
    }

    this.replaceKeys(record);
    super.replace(record);
  }

  protected override staleState(): unknown {
    const ownerAny = this.owner as any;
    const fk = this.foreignKeyName();
    return typeof ownerAny.readAttribute === "function"
      ? ownerAny.readAttribute(fk)
      : (ownerAny as any)[fk];
  }

  protected override findTarget(): boolean {
    return !this.isLoaded() && this.foreignKeyPresent() && !!this.klass;
  }

  private foreignKeyName(): string {
    const fk = this.reflection.options.foreignKey;
    if (typeof fk === "string") return fk;
    return `${underscore(this.reflection.name)}Id`;
  }

  private foreignKeyPresent(): boolean {
    const fk = this.foreignKeyName();
    const ownerAny = this.owner as any;
    const value =
      typeof ownerAny.readAttribute === "function" ? ownerAny.readAttribute(fk) : ownerAny[fk];
    return value != null;
  }

  private replaceKeys(record: Base | null): void {
    const fk = this.foreignKeyName();
    const ownerAny = this.owner as any;
    const targetKeyValue = record ? (record as any).id : null;

    if (typeof ownerAny.writeAttribute === "function") {
      ownerAny.writeAttribute(fk, targetKeyValue);
    } else {
      ownerAny[fk] = targetKeyValue;
    }
  }

  private updateCounters(by: number): void {
    const counterCache = this.reflection.options.counterCache;
    if (!counterCache) return;
    if (!(this.owner as any).isPersisted?.()) return;

    if (this.target && typeof (this.target as any).increment === "function") {
      const column =
        typeof counterCache === "string"
          ? counterCache
          : `${underscore(this.reflection.name)}Count`;
      (this.target as any).increment(column, by);
    }
  }
}
