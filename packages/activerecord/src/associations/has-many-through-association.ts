import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { HasManyAssociation } from "./has-many-association.js";

/**
 * Mirrors: ActiveRecord::Associations::HasManyThroughAssociation
 */
export class HasManyThroughAssociation extends HasManyAssociation {
  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }
}

function buildThroughRecord(assoc: HasManyThroughAssociation, record: Base): Base | null {
  return (assoc as any)._buildThroughRecord?.(record) ?? null;
}

function throughScope(assoc: HasManyThroughAssociation): unknown {
  return (assoc as any)._throughScope ?? null;
}

function throughScopeAttributes(assoc: HasManyThroughAssociation): Record<string, unknown> {
  return (assoc as any)._throughScopeAttributes?.() ?? {};
}

function saveThroughRecord(assoc: HasManyThroughAssociation, record: Base): Promise<boolean> {
  return (assoc as any)._saveThroughRecord?.(record) ?? Promise.resolve(true);
}

function removeRecords(
  assoc: HasManyThroughAssociation,
  existingRecords: Base[],
  records: Base[],
  method: string,
): Promise<void> {
  return (assoc as any).delete?.(...records) ?? Promise.resolve();
}

function isTargetReflectionHasAssociatedRecord(assoc: HasManyThroughAssociation): boolean {
  const throughRefl = assoc.reflection.options.through;
  if (!throughRefl) return false;
  const throughAssoc = (assoc.owner as any).association?.(throughRefl);
  if (!throughAssoc) return false;
  const fk = throughAssoc.reflection?.foreignKey;
  if (!fk) return true;
  return !!(assoc.owner as any).readAttribute?.(fk as string);
}

function isUpdateThroughCounter(assoc: HasManyThroughAssociation, method: string): boolean {
  return method !== "destroy" && (assoc as any)._isUpdateThroughCounter?.(method) !== false;
}

function deleteOrNullifyAllRecords(
  assoc: HasManyThroughAssociation,
  method: string,
): Promise<void> {
  return (assoc as any).deleteAll?.(method) ?? Promise.resolve();
}

function deleteRecords(
  assoc: HasManyThroughAssociation,
  records: Base[],
  method: string,
): Promise<void> {
  return (assoc as any).delete?.(...records) ?? Promise.resolve();
}

function difference(assoc: HasManyThroughAssociation, a: Base[], b: Base[]): Base[] {
  return a.filter((r) => !b.includes(r));
}

function intersection(assoc: HasManyThroughAssociation, a: Base[], b: Base[]): Base[] {
  return a.filter((r) => b.includes(r));
}

function markOccurrence(
  assoc: HasManyThroughAssociation,
  distribution: Map<Base, number>,
  record: Base,
): boolean {
  const count = distribution.get(record) ?? 0;
  if (count > 0) {
    distribution.set(record, count - 1);
    return true;
  }
  return false;
}

function distribution(assoc: HasManyThroughAssociation, array: Base[]): Map<Base, number> {
  const result = new Map<Base, number>();
  for (const r of array) result.set(r, (result.get(r) ?? 0) + 1);
  return result;
}

function throughRecordsFor(assoc: HasManyThroughAssociation, record: Base): Base[] {
  return (assoc as any)._throughRecordsFor?.(record) ?? [];
}

function deleteThroughRecords(assoc: HasManyThroughAssociation, records: Base[]): Promise<void> {
  return (assoc as any)._deleteThroughRecords?.(records) ?? Promise.resolve();
}
