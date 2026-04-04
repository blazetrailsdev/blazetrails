import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { resolveModel } from "../associations.js";
import { underscore } from "@blazetrails/activesupport";
import { BelongsToAssociation } from "./belongs-to-association.js";

/**
 * Mirrors: ActiveRecord::Associations::BelongsToPolymorphicAssociation
 */
export class BelongsToPolymorphicAssociation extends BelongsToAssociation {
  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }

  override get klass(): typeof Base {
    const foreignType = this.foreignTypeName();
    const ownerAny = this.owner as any;
    const type =
      typeof ownerAny.readAttribute === "function"
        ? ownerAny.readAttribute(foreignType)
        : ownerAny[foreignType];

    if (!type) return undefined as any;
    return resolveModel(type);
  }

  override isTargetChanged(): boolean {
    return super.isTargetChanged() || this.foreignTypeChanged();
  }

  override isTargetPreviouslyChanged(): boolean {
    return super.isTargetPreviouslyChanged() || this.foreignTypePreviouslyChanged();
  }

  override isSavedChangeToTarget(): boolean {
    return super.isSavedChangeToTarget() || this.savedChangeToForeignType();
  }

  private foreignTypeName(): string {
    return this.reflection.options.foreignKey
      ? `${String(this.reflection.options.foreignKey).replace(/Id$/, "")}Type`
      : `${underscore(this.reflection.name)}Type`;
  }

  private foreignTypeChanged(): boolean {
    const ownerAny = this.owner as any;
    const ft = this.foreignTypeName();
    return typeof ownerAny.attributeChanged === "function"
      ? ownerAny.attributeChanged(ft)
      : typeof ownerAny.isAttributeChanged === "function"
        ? ownerAny.isAttributeChanged(ft)
        : false;
  }

  private foreignTypePreviouslyChanged(): boolean {
    const ownerAny = this.owner as any;
    const ft = this.foreignTypeName();
    return typeof ownerAny.attributePreviouslyChanged === "function"
      ? ownerAny.attributePreviouslyChanged(ft)
      : typeof ownerAny.isAttributePreviouslyChanged === "function"
        ? ownerAny.isAttributePreviouslyChanged(ft)
        : false;
  }

  private savedChangeToForeignType(): boolean {
    const ownerAny = this.owner as any;
    const ft = this.foreignTypeName();
    return typeof ownerAny.savedChangeToAttribute === "function"
      ? ownerAny.savedChangeToAttribute(ft)
      : typeof ownerAny.isSavedChangeToAttribute === "function"
        ? ownerAny.isSavedChangeToAttribute(ft)
        : false;
  }
}
