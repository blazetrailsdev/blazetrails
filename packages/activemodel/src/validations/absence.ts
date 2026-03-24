import type { AnyRecord, ConditionalOptions, Errors, Validator } from "./helpers.js";
import { isBlank, shouldValidate } from "./helpers.js";

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
