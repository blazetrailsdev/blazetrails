/**
 * Mirrors: ActiveRecord::Validations::PresenceValidator
 *
 * Extends ActiveModel's PresenceValidator with association awareness —
 * if the attribute is an association, objects marked for destruction
 * are excluded from the presence check.
 */
import { PresenceValidator as BasePresenceValidator } from "@blazetrails/activemodel";

export class PresenceValidator extends BasePresenceValidator {
  validate(record: any, attribute: string, value: unknown, errors: any): void {
    if (isAssociation(record, attribute)) {
      const filtered = filterDestroyed(value);
      if (
        filtered === null ||
        filtered === undefined ||
        (Array.isArray(filtered) && filtered.length === 0)
      ) {
        errors.add(attribute, "blank");
        return;
      }
      return;
    }
    super.validate(record, attribute, value, errors);
  }
}

function isAssociation(record: any, attribute: string): boolean {
  const associations: any[] = record.constructor._associations ?? [];
  return associations.some((a: any) => a.name === attribute);
}

function filterDestroyed(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter((v: any) => !v?.markedForDestruction?.());
  }
  if (
    value &&
    typeof (value as any).markedForDestruction === "function" &&
    (value as any).markedForDestruction()
  ) {
    return null;
  }
  return value;
}
