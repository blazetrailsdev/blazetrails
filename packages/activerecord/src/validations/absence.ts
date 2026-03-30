/**
 * Mirrors: ActiveRecord::Validations::AbsenceValidator
 *
 * Extends ActiveModel's AbsenceValidator with association awareness —
 * if the attribute is an association, objects marked for destruction
 * are excluded from the absence check.
 */
import { AbsenceValidator as BaseAbsenceValidator } from "@blazetrails/activemodel";
import { isMarkedForDestruction } from "../autosave-association.js";

export class AbsenceValidator extends BaseAbsenceValidator {
  validate(record: any, attribute: string, value: unknown, errors: any): void {
    if (isAssociation(record, attribute)) {
      const resolved = resolveAssociation(record, attribute, value);
      const filtered = filterDestroyed(resolved);
      super.validate(record, attribute, filtered, errors);
      return;
    }
    super.validate(record, attribute, value, errors);
  }
}

function isAssociation(record: any, attribute: string): boolean {
  const associations: any[] = record.constructor._associations ?? [];
  return associations.some((a: any) => a.name === attribute);
}

function resolveAssociation(record: any, attribute: string, fallback: unknown): unknown {
  if (typeof record.association === "function") {
    const assoc = record.association(attribute);
    if (assoc?.target !== undefined) return assoc.target;
  }
  if (attribute in record) return record[attribute];
  return fallback;
}

function filterDestroyed(value: unknown): unknown {
  if (Array.isArray(value)) {
    const filtered = value.filter((v: any) => !isMarkedForDestruction(v));
    return filtered.length > 0 ? filtered : null;
  }
  if (value && isMarkedForDestruction(value as any)) {
    return null;
  }
  return value;
}
