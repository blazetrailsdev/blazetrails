import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { loadBelongsTo } from "../associations.js";
import { underscore } from "@blazetrails/activesupport";
import { SingularAssociation } from "./singular-association.js";

/**
 * Mirrors: ActiveRecord::Associations::BelongsToAssociation
 *
 * Manages the belongs_to side of an association. Handles FK replacement,
 * counter cache updates, change tracking, and dependent destruction.
 */
export class BelongsToAssociation extends SingularAssociation {
  private _updated = false;

  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }

  /**
   * Handle dependent destruction/deletion of the target record.
   * Called by the owner's before_destroy callback.
   */
  async handleDependency(): Promise<void> {
    await this.asyncLoadTarget();
    const target = this.target;
    if (!target) return;

    const dependent = this.reflection.options.dependent;
    if (!dependent) return;

    switch (dependent) {
      case "destroy":
        if (typeof (target as any).destroy === "function") {
          await (target as any).destroy();
        }
        break;
      case "delete":
        if (typeof (target as any).delete === "function") {
          await (target as any).delete();
        }
        break;
    }
  }

  /**
   * When set from the inverse side, also update the FK on the owner
   * to point to the new record.
   */
  override inversedFrom(record: Base | null): void {
    this.replaceKeys(record);
    super.inversedFrom(record);
  }

  /**
   * Set the default value for this association if the current reader is nil.
   * Called by the before_validation callback set up by the builder.
   */
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

  /**
   * Decrement the counter cache column on the target by 1.
   * Called when the owner is removed from this association.
   */
  async decrementCounters(): Promise<void> {
    await this.updateCounters(-1);
  }

  /**
   * Increment the counter cache column on the target by 1.
   * Called when the owner is added to this association.
   */
  async incrementCounters(): Promise<void> {
    await this.updateCounters(1);
  }

  /**
   * Decrement counters for the previously associated record (before last save).
   * Used during counter cache updates on FK change.
   */
  async decrementCountersBeforeLastSave(): Promise<void> {
    const ownerAny = this.owner as any;
    const fk = this.foreignKeyName();
    const foreignKeyWas =
      typeof ownerAny.attributeBeforeLastSave === "function"
        ? ownerAny.attributeBeforeLastSave(fk)
        : undefined;

    if (foreignKeyWas != null) {
      const counterCol = this.counterCacheColumn();
      if (!counterCol) return;

      const Klass = this.klass;
      if (Klass && typeof (Klass as any).where === "function") {
        const pk = (Klass as any).primaryKey ?? "id";
        const scope = (Klass as any).where({ [pk]: foreignKeyWas });
        if (typeof scope.updateCounters === "function") {
          await scope.updateCounters({ [counterCol]: -1 });
        }
      }
    }
  }

  /**
   * Returns true if the FK has changed since the last save, or if the
   * target is an unsaved new record.
   */
  isTargetChanged(): boolean {
    const ownerAny = this.owner as any;
    const fk = this.foreignKeyName();
    const changed = this.ownerAttributeChanged(fk);
    return (
      changed ||
      (!this.foreignKeyPresent() &&
        this.target != null &&
        (typeof (this.target as any).isNewRecord === "function"
          ? (this.target as any).isNewRecord()
          : !(this.target as any)._persisted))
    );
  }

  isTargetPreviouslyChanged(): boolean {
    return this.ownerAttributePreviouslyChanged(this.foreignKeyName());
  }

  isSavedChangeToTarget(): boolean {
    return this.ownerSavedChangeToAttribute(this.foreignKeyName());
  }

  /**
   * Build a scope on the target model, filtering by the owner's FK value
   * against the target's PK. This is the reverse direction from has_many.
   */
  override scope(): any {
    const Klass = this.klass as any;
    if (!Klass || typeof Klass.all !== "function") return null;

    const fk = this.foreignKeyName();
    const ownerAny = this.owner as any;
    const fkValue =
      typeof ownerAny.readAttribute === "function" ? ownerAny.readAttribute(fk) : ownerAny[fk];
    if (fkValue == null) return null;

    const pk = this.reflection.options.primaryKey ?? Klass.primaryKey ?? "id";
    let rel = Klass.all().where({ [pk as string]: fkValue });
    if (this.reflection.options.scope) {
      rel = this.reflection.options.scope(rel);
    }
    return rel;
  }

  // --- Protected ---

  protected override replace(record: Base | null): void {
    if (record) {
      this.setInverseInstance(record);
      this._updated = true;
    } else if (this.target) {
      this.removeInverseInstance(this.target);
    }

    this.replaceKeys(record);
    this.target = record;
    if (record !== null) {
      this.loadedBang();
    }
  }

  protected override staleState(): unknown {
    const ownerAny = this.owner as any;
    const fk = this.foreignKeyName();
    return typeof ownerAny.readAttribute === "function" ? ownerAny.readAttribute(fk) : ownerAny[fk];
  }

  protected override findTargetNeeded(): boolean {
    return !this.isLoaded() && this.foreignKeyPresent();
  }

  protected override foreignKeyPresent(): boolean {
    const fk = this.foreignKeyName();
    const ownerAny = this.owner as any;
    const value =
      typeof ownerAny.readAttribute === "function" ? ownerAny.readAttribute(fk) : ownerAny[fk];
    return value != null;
  }

  protected override async doAsyncFindTarget(): Promise<Base | null> {
    return loadBelongsTo(this.owner, this.reflection.name, this.reflection.options);
  }

  // --- Private helpers ---

  private foreignKeyName(): string {
    const fk = this.reflection.options.foreignKey;
    if (typeof fk === "string") return fk;
    return `${underscore(this.reflection.name)}Id`;
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

  private counterCacheColumn(): string | null {
    const cc = this.reflection.options.counterCache;
    if (!cc) return null;
    if (typeof cc === "string") return cc;
    return `${underscore(this.reflection.name)}Count`;
  }

  private async updateCounters(by: number): Promise<void> {
    const counterCol = this.counterCacheColumn();
    if (!counterCol) return;
    if (!(this.owner as any)._persisted) return;
    if (!this.foreignKeyPresent()) return;

    if (this.target && !this.isStaleTarget()) {
      // Update the in-memory target's counter directly
      if (typeof (this.target as any).increment === "function") {
        (this.target as any).increment(counterCol, by);
      }
    } else {
      // Update via scope against the database
      const fkValue = (this.owner as any).readAttribute?.(this.foreignKeyName());
      if (fkValue != null) {
        const Klass = this.klass;
        if (Klass && typeof (Klass as any).where === "function") {
          const pk = (Klass as any).primaryKey ?? "id";
          const scope = (Klass as any).where({ [pk]: fkValue });
          if (typeof scope.updateCounters === "function") {
            await scope.updateCounters({ [counterCol]: by });
          }
        }
      }
    }
  }

  protected ownerAttributeChanged(attr: string): boolean {
    const ownerAny = this.owner as any;
    if (typeof ownerAny.attributeChanged === "function") return ownerAny.attributeChanged(attr);
    if (typeof ownerAny.isAttributeChanged === "function") return ownerAny.isAttributeChanged(attr);
    return false;
  }

  protected ownerAttributePreviouslyChanged(attr: string): boolean {
    const ownerAny = this.owner as any;
    if (typeof ownerAny.attributePreviouslyChanged === "function")
      return ownerAny.attributePreviouslyChanged(attr);
    if (typeof ownerAny.isAttributePreviouslyChanged === "function")
      return ownerAny.isAttributePreviouslyChanged(attr);
    return false;
  }

  protected ownerSavedChangeToAttribute(attr: string): boolean {
    const ownerAny = this.owner as any;
    if (typeof ownerAny.savedChangeToAttribute === "function")
      return ownerAny.savedChangeToAttribute(attr);
    if (typeof ownerAny.isSavedChangeToAttribute === "function")
      return ownerAny.isSavedChangeToAttribute(attr);
    return false;
  }
}
