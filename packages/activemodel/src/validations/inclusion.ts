import { EachValidator } from "../validator.js";
import type { AnyRecord } from "../validator.js";
import {
  checkValidityBang,
  delimiter,
  inclusionMethod,
  isInclude,
  resolveValue,
} from "./clusivity.js";

/**
 * Mirrors: ActiveModel::Validations::InclusionValidator (inclusion.rb)
 *
 *   class InclusionValidator < EachValidator
 *     include Clusivity
 *     def validate_each(record, attribute, value)
 *       unless include?(record, value)
 *         record.errors.add(attribute, :inclusion,
 *           **options.except(:in, :within).merge!(value: value))
 *       end
 *     end
 *   end
 */
export class InclusionValidator extends EachValidator {
  resolveValue = resolveValue;
  delimiter = delimiter;
  inclusionMethod = inclusionMethod;
  isInclude = isInclude;

  override checkValidity(): void {
    checkValidityBang.call(this);
  }

  validateEach(record: AnyRecord, attribute: string, value: unknown): void {
    if (this.options.allowNil !== false && (value === null || value === undefined)) return;
    if (!this.isInclude(record, value)) {
      record.errors.add(attribute, "inclusion", inclusionErrorOptions(this.options, value));
    }
  }
}

function inclusionErrorOptions(
  options: Record<string, unknown>,
  value: unknown,
): Record<string, unknown> {
  // Rails: options.except(:in, :within).merge!(value: value)
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(options)) {
    if (key !== "in" && key !== "within") rest[key] = options[key];
  }
  rest.value = value;
  return rest;
}
