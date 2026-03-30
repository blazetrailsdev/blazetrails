import { isMarkedForDestruction } from "../autosave-association.js";

export function isAssociation(record: any, attribute: string): boolean {
  const associations: any[] = record.constructor._associations ?? [];
  return associations.some((a: any) => a.name === attribute);
}

export function resolveAssociation(record: any, attribute: string, fallback: unknown): unknown {
  if (typeof record.association === "function") {
    const assoc = record.association(attribute);
    if (assoc?.target !== undefined) return assoc.target;
  }
  if (attribute in record) return record[attribute];
  return fallback;
}

export function filterDestroyed(value: unknown): unknown {
  if (Array.isArray(value)) {
    const filtered = value.filter((v: any) => !isMarkedForDestruction(v));
    return filtered.length > 0 ? filtered : null;
  }
  if (value && isMarkedForDestruction(value as any)) {
    return null;
  }
  return value;
}
