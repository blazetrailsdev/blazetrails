import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { loadBelongsTo } from "../associations.js";
import { underscore, pluralize } from "@blazetrails/activesupport";
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
   */
  async decrementCounters(): Promise<void> {
    await this.updateCounters(-1);
  }

  /**
   * Increment the counter cache column on the target by 1.
   */
  async incrementCounters(): Promise<void> {
    await this.updateCounters(1);
  }

  /**
   * Decrement counters for the previously associated record (before last save).
   */
  async decrementCountersBeforeLastSave(): Promise<void> {
    const fk = this.foreignKeyName();
    const foreignKeyWas =
      typeof this.owner.attributeBeforeLastSave === "function"
        ? (this.owner as any).attributeBeforeLastSave(fk)
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
    const fk = this.foreignKeyName();
    const changed = this.ownerAttributeChanged(fk);
    return (
      changed || (!this.foreignKeyPresent() && this.target != null && this.target.isNewRecord())
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
    const fkValue =
      typeof this.owner.readAttribute === "function"
        ? this.owner.readAttribute(fk)
        : (this.owner as any)[fk];
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
    const fk = this.foreignKeyName();
    return typeof this.owner.readAttribute === "function"
      ? this.owner.readAttribute(fk)
      : (this.owner as any)[fk];
  }

  protected override findTargetNeeded(): boolean {
    return !this.isLoaded() && this.foreignKeyPresent();
  }

  protected override foreignKeyPresent(): boolean {
    const fk = this.foreignKeyName();
    const value =
      typeof this.owner.readAttribute === "function"
        ? this.owner.readAttribute(fk)
        : (this.owner as any)[fk];
    return value != null;
  }

  protected override async doAsyncFindTarget(): Promise<Base | null> {
    return loadBelongsTo(this.owner, this.reflection.name, this.reflection.options);
  }

  // --- Private helpers ---

  private foreignKeyName(): string {
    const fk = this.reflection.options.foreignKey;
    if (typeof fk === "string") return fk;
    return `${underscore(this.reflection.name)}_id`;
  }

  private replaceKeys(record: Base | null): void {
    const fk = this.foreignKeyName();
    const targetPk = this.associationPrimaryKey(record);
    const targetKeyValue = record
      ? typeof record.readAttribute === "function"
        ? record.readAttribute(targetPk)
        : (record as any)[targetPk]
      : null;

    if (typeof this.owner.writeAttribute === "function") {
      (this.owner as any).writeAttribute(fk, targetKeyValue);
    } else {
      (this.owner as any)[fk] = targetKeyValue;
    }
  }

  private associationPrimaryKey(record: Base | null): string {
    if (this.reflection.options.primaryKey) {
      return typeof this.reflection.options.primaryKey === "string"
        ? this.reflection.options.primaryKey
        : this.reflection.options.primaryKey[0];
    }
    if (record) {
      const ctor = record.constructor as any;
      const pk = ctor.primaryKey;
      return typeof pk === "string" ? pk : Array.isArray(pk) ? pk[0] : "id";
    }
    return (this.klass as any).primaryKey ?? "id";
  }

  /**
   * Resolve the counter cache column name. In Rails, for a belongs_to :author
   * on Post, the counter column on Author is `posts_count` (pluralized
   * owner model name, snake_case, + _count).
   */
  private counterCacheColumn(): string | null {
    const cc = this.reflection.options.counterCache;
    if (!cc) return null;
    if (typeof cc === "string") return cc;
    const ownerCtor = this.owner.constructor as any;
    return `${pluralize(underscore(ownerCtor.name))}_count`;
  }

  private async updateCounters(by: number): Promise<void> {
    const counterCol = this.counterCacheColumn();
    if (!counterCol) return;
    if (!this.owner.isPersisted()) return;
    if (!this.foreignKeyPresent()) return;

    if (this.target && !this.isStaleTarget()) {
      if (typeof (this.target as any).increment === "function") {
        (this.target as any).increment(counterCol, by);
      }
    } else {
      const fkValue = this.owner.readAttribute?.(this.foreignKeyName());
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
    if (typeof (this.owner as any).attributeChanged === "function")
      return (this.owner as any).attributeChanged(attr);
    if (typeof (this.owner as any).isAttributeChanged === "function")
      return (this.owner as any).isAttributeChanged(attr);
    return false;
  }

  protected ownerAttributePreviouslyChanged(attr: string): boolean {
    if (typeof (this.owner as any).attributePreviouslyChanged === "function")
      return (this.owner as any).attributePreviouslyChanged(attr);
    if (typeof (this.owner as any).isAttributePreviouslyChanged === "function")
      return (this.owner as any).isAttributePreviouslyChanged(attr);
    return false;
  }

  protected ownerSavedChangeToAttribute(attr: string): boolean {
    if (typeof (this.owner as any).savedChangeToAttribute === "function")
      return (this.owner as any).savedChangeToAttribute(attr);
    if (typeof (this.owner as any).isSavedChangeToAttribute === "function")
      return (this.owner as any).isSavedChangeToAttribute(attr);
    return false;
  }
}
