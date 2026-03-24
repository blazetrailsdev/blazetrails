import type { Errors } from "../errors.js";
import type { Validator, ConditionalOptions, AnyRecord } from "../validator.js";
import { shouldValidate } from "../validator.js";
export { shouldValidate };
export type { Errors, Validator, ConditionalOptions, AnyRecord };

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}
