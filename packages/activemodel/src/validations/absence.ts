import type { Errors } from "../errors.js";
import type {
  AnyRecord,
  ConditionalOptions,
  ValidatorContract as Validator,
} from "../validator.js";
import { shouldValidate } from "../validator.js";
import { isBlank } from "@rails-ts/activesupport";

export interface AbsenceOptions extends ConditionalOptions {
  message?: string;
}

export class AbsenceValidator implements Validator {
  constructor(private options: AbsenceOptions = {}) {}

  validate(record: AnyRecord, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    if (!isBlank(value)) {
      errors.add(attribute, "present", { message: this.options.message });
    }
  }
}

export interface HelperMethods {
  validatesAbsenceOf(...args: unknown[]): void;
  validatesAcceptanceOf(...args: unknown[]): void;
  validatesComparisonOf(...args: unknown[]): void;
  validatesConfirmationOf(...args: unknown[]): void;
  validatesExclusionOf(...args: unknown[]): void;
  validatesFormatOf(...args: unknown[]): void;
  validatesInclusionOf(...args: unknown[]): void;
  validatesLengthOf(...args: unknown[]): void;
  validatesNumericalityOf(...args: unknown[]): void;
  validatesPresenceOf(...args: unknown[]): void;
}
