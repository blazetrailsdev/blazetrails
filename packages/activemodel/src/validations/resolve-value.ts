/**
 * ResolveValue — resolves a validator option to its runtime value.
 *
 * Mirrors: ActiveModel::Validations::ResolveValue
 *
 * Rails accepts a Proc (callable) or a Symbol (method name on the record).
 * TS has no Symbol/String distinction, so a string is only treated as a
 * method reference when the record actually responds to it; otherwise the
 * string is returned as a literal value.
 */
export interface ResolveValue {
  resolveValue(record: unknown, value: unknown): unknown;
}

export function resolveValue(record: unknown, value: unknown): unknown {
  if (typeof value === "function") {
    return (value as (record: unknown) => unknown)(record);
  }
  if (
    typeof value === "string" &&
    record &&
    typeof record === "object" &&
    value in (record as object)
  ) {
    const method = (record as Record<string, unknown>)[value];
    if (typeof method === "function") {
      return (method as () => unknown).call(record);
    }
    return method;
  }
  return value;
}
