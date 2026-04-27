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
  const throughName = assoc.reflection.options.through as string | undefined;
  if (!throughName) return null;
  const throughAssoc = (assoc.owner as any).association?.(throughName);
  if (!throughAssoc) return null;
  // Build a new through-model record with the source association FK wired to record.
  const sourceName = assoc.reflection.options.source ?? assoc.reflection.name;
  const attrs: Record<string, unknown> = {};
  // Set the source FK to point at the target record's PK
  const sourceRefl = (throughAssoc.klass as any)?._reflectOnAssociation?.(String(sourceName));
  const sourceFk = sourceRefl?.options?.foreignKey ?? `${String(sourceName)}_id`;
  attrs[String(sourceFk)] = (record as any).id;
  return typeof throughAssoc.build === "function" ? throughAssoc.build(attrs) : null;
}

function throughScope(assoc: HasManyThroughAssociation): unknown {
  // through_scope is set externally by the association's concat/insert path.
  // Return the memoized scope if it was set; otherwise null.
  return (assoc as any)._throughScope ?? null;
}

function throughScopeAttributes(assoc: HasManyThroughAssociation): Record<string, unknown> {
  // Extract WHERE conditions from the through scope for the through model's table.
  const throughName = assoc.reflection.options.through as string | undefined;
  if (!throughName) return {};
  const throughAssoc = (assoc.owner as any).association?.(throughName);
  if (!throughAssoc) return {};
  const scope: any = throughAssoc.scope?.();
  if (!scope || typeof scope.whereValuesHash !== "function") return {};
  const throughTable = (throughAssoc.klass as any)?.tableName ?? "";
  const attrs = scope.whereValuesHash(throughTable) as Record<string, unknown>;
  // Exclude the FK columns and the STI inheritance column.
  const throughFk = throughAssoc.reflection?.options?.foreignKey ?? "";
  const inheritanceCol = (throughAssoc.klass as any)?.inheritanceColumn ?? "type";
  for (const key of [String(throughFk), inheritanceCol]) {
    if (key in attrs) delete attrs[key];
  }
  return attrs;
}

function saveThroughRecord(assoc: HasManyThroughAssociation, record: Base): Promise<boolean> {
  // Find and save the first unsaved through record for this target.
  const records = throughRecordsFor(assoc, record);
  const first = records[0];
  if (!first || (first as any).isDestroyed?.()) return Promise.resolve(true);
  if (typeof (first as any).save === "function") {
    return (first as any).save({ validate: true });
  }
  return Promise.resolve(true);
}

function removeRecords(
  assoc: HasManyThroughAssociation,
  _existingRecords: Base[],
  records: Base[],
  _method: string,
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

function difference(_assoc: HasManyThroughAssociation, a: Base[], b: Base[]): Base[] {
  return a.filter((r) => !b.includes(r));
}

function intersection(_assoc: HasManyThroughAssociation, a: Base[], b: Base[]): Base[] {
  return a.filter((r) => b.includes(r));
}

function markOccurrence(
  _assoc: HasManyThroughAssociation,
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

function distribution(_assoc: HasManyThroughAssociation, array: Base[]): Map<Base, number> {
  const result = new Map<Base, number>();
  for (const r of array) result.set(r, (result.get(r) ?? 0) + 1);
  return result;
}

function throughRecordsFor(assoc: HasManyThroughAssociation, record: Base): Base[] {
  // Mirrors Rails: find through-model records whose source FK matches the target record.
  // construct_join_attributes gives us the FK map; filter through_association.target.
  const throughName = assoc.reflection.options.through as string | undefined;
  if (!throughName) return [];
  const throughAssoc = (assoc.owner as any).association?.(throughName);
  if (!throughAssoc) return [];
  const sourceName = assoc.reflection.options.source ?? assoc.reflection.name;
  const sourceRefl = (throughAssoc.klass as any)?._reflectOnAssociation?.(String(sourceName));
  const sourceFk = sourceRefl?.options?.foreignKey ?? `${String(sourceName)}_id`;
  const targetId = (record as any).id;
  const candidates: Base[] = Array.isArray(throughAssoc.target)
    ? throughAssoc.target
    : throughAssoc.target
      ? [throughAssoc.target]
      : [];
  return candidates.filter((c) => (c as any).readAttribute?.(String(sourceFk)) === targetId);
}

function deleteThroughRecords(assoc: HasManyThroughAssociation, records: Base[]): Promise<void> {
  // Mirrors Rails delete_through_records: remove through join-model records.
  const throughName = assoc.reflection.options.through as string | undefined;
  if (!throughName) return Promise.resolve();
  const throughAssoc = (assoc.owner as any).association?.(throughName);
  if (!throughAssoc) return Promise.resolve();
  for (const record of records) {
    const toDelete = throughRecordsFor(assoc, record);
    if (Array.isArray(throughAssoc.target)) {
      for (const r of toDelete) {
        const idx = (throughAssoc.target as Base[]).indexOf(r);
        if (idx !== -1) (throughAssoc.target as Base[]).splice(idx, 1);
      }
    } else if (toDelete.length > 0 && throughAssoc.target === toDelete[0]) {
      throughAssoc.target = null;
    }
  }
  return Promise.resolve();
}
