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

async function createThroughRecord(
  assoc: HasOneThroughAssociation,
  record: Base | null,
  save: boolean,
): Promise<Base | null> {
  // Mirrors Rails HasOneThroughAssociation#create_through_record:
  // 1. ensure_not_nested
  // 2. load the current through record
  // 3. if record is nil → destroy through record
  // 4. otherwise build/update through record with construct_join_attributes
  const throughName = assoc.reflection.options.through as string | undefined;
  if (!throughName) return null;
  const throughProxy = (assoc.owner as any).association?.(throughName);
  if (!throughProxy) return null;

  const throughRecord = await throughProxy.loadTarget?.();

  if (throughRecord && !record) {
    await (throughRecord as any).destroy?.();
    return null;
  }

  if (record) {
    // Build the attributes joining the through model to the target
    const sourceRefl = (assoc.reflection as any).sourceReflection?.() as any;
    const attrs: Record<string, unknown> = {};
    if (sourceRefl) {
      const fk: string = sourceRefl.foreignKey ?? `${sourceRefl.name}_id`;
      attrs[fk] = (record as any).id;
    }

    if (throughRecord) {
      if ((throughRecord as any).isNewRecord?.()) {
        await (throughRecord as any).assignAttributes?.(attrs);
      } else {
        await (throughRecord as any).update?.(attrs);
      }
    } else if ((assoc.owner as any).isNewRecord?.() || !save) {
      throughProxy.build?.(attrs);
    } else {
      await throughProxy.create?.(attrs);
    }
  }
  return record;
}
