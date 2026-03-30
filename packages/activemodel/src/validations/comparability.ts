/**
 * Comparability — helper for validators that compare values.
 *
 * Mirrors: ActiveModel::Validations::Comparability
 *
 * In Rails, Comparability is included by ComparisonValidator and
 * NumericalityValidator. It provides error_options which builds
 * the error message interpolation hash with the comparison target.
 */
export interface Comparability {
  errorOptions(value: unknown, record: unknown): Record<string, unknown>;
}

export function errorOptions(optionValue: unknown, record: unknown): Record<string, unknown> {
  if (typeof optionValue === "function") {
    const resolved = (optionValue as (record: unknown) => unknown)(record);
    return { count: resolved };
  }
  if (typeof optionValue === "string" && record && typeof record === "object") {
    const method = (record as Record<string, unknown>)[optionValue];
    if (typeof method === "function") {
      return { count: (method as () => unknown).call(record) };
    }
    return { count: method };
  }
  return { count: optionValue };
}
