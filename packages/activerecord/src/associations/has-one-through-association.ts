import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { HasOneAssociation } from "./has-one-association.js";

/**
 * Mirrors: ActiveRecord::Associations::HasOneThroughAssociation
 */
export class HasOneThroughAssociation extends HasOneAssociation {
  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }
}

function createThroughRecord(
  assoc: HasOneThroughAssociation,
  record: Base,
  save: boolean,
): Promise<Base | null> {
  return (assoc as any).replace(record, save);
}
