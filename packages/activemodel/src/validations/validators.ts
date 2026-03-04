import type { Errors } from "../errors.js";
import type { Validator, ConditionalOptions } from "./validator.js";
import { shouldValidate } from "./validator.js";

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export interface PresenceOptions extends ConditionalOptions {
  message?: string;
}

export class PresenceValidator implements Validator {
  constructor(private options: PresenceOptions = {}) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    if (isBlank(value)) {
      errors.add(attribute, "blank", { message: this.options.message });
    }
  }
}

export interface AbsenceOptions extends ConditionalOptions {
  message?: string;
}

export class AbsenceValidator implements Validator {
  constructor(private options: AbsenceOptions = {}) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    if (!isBlank(value)) {
      errors.add(attribute, "present", { message: this.options.message });
    }
  }
}

export interface LengthOptions extends ConditionalOptions {
  minimum?: number;
  maximum?: number;
  is?: number;
  in?: [number, number];
  message?: string;
  tooShort?: string;
  tooLong?: string;
  wrongLength?: string;
}

export class LengthValidator implements Validator {
  constructor(private options: LengthOptions = {}) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    if (value === null || value === undefined) return;
    const length = typeof value === "string" ? value.length : Array.isArray(value) ? value.length : 0;

    const min = this.options.in ? this.options.in[0] : this.options.minimum;
    const max = this.options.in ? this.options.in[1] : this.options.maximum;

    if (min !== undefined && length < min) {
      errors.add(attribute, "too_short", {
        message: this.options.tooShort ?? this.options.message,
        count: min,
      });
    }
    if (max !== undefined && length > max) {
      errors.add(attribute, "too_long", {
        message: this.options.tooLong ?? this.options.message,
        count: max,
      });
    }
    if (this.options.is !== undefined && length !== this.options.is) {
      errors.add(attribute, "wrong_length", {
        message: this.options.wrongLength ?? this.options.message,
        count: this.options.is,
      });
    }
  }
}

export interface NumericalityOptions extends ConditionalOptions {
  onlyInteger?: boolean;
  greaterThan?: number;
  greaterThanOrEqualTo?: number;
  lessThan?: number;
  lessThanOrEqualTo?: number;
  equalTo?: number;
  otherThan?: number;
  odd?: boolean;
  even?: boolean;
  message?: string;
}

export class NumericalityValidator implements Validator {
  constructor(private options: NumericalityOptions = {}) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    if (value === null || value === undefined) return;

    const num = Number(value);
    if (isNaN(num)) {
      errors.add(attribute, "not_a_number", { message: this.options.message });
      return;
    }

    if (this.options.onlyInteger && !Number.isInteger(num)) {
      errors.add(attribute, "not_an_integer", { message: this.options.message });
      return;
    }

    if (this.options.greaterThan !== undefined && !(num > this.options.greaterThan)) {
      errors.add(attribute, "greater_than", { count: this.options.greaterThan });
    }
    if (this.options.greaterThanOrEqualTo !== undefined && !(num >= this.options.greaterThanOrEqualTo)) {
      errors.add(attribute, "greater_than_or_equal_to", { count: this.options.greaterThanOrEqualTo });
    }
    if (this.options.lessThan !== undefined && !(num < this.options.lessThan)) {
      errors.add(attribute, "less_than", { count: this.options.lessThan });
    }
    if (this.options.lessThanOrEqualTo !== undefined && !(num <= this.options.lessThanOrEqualTo)) {
      errors.add(attribute, "less_than_or_equal_to", { count: this.options.lessThanOrEqualTo });
    }
    if (this.options.equalTo !== undefined && num !== this.options.equalTo) {
      errors.add(attribute, "equal_to", { count: this.options.equalTo });
    }
    if (this.options.otherThan !== undefined && num === this.options.otherThan) {
      errors.add(attribute, "other_than", { count: this.options.otherThan });
    }
    if (this.options.odd && num % 2 === 0) {
      errors.add(attribute, "odd");
    }
    if (this.options.even && num % 2 !== 0) {
      errors.add(attribute, "even");
    }
  }
}

export interface InclusionOptions extends ConditionalOptions {
  in: unknown[];
  message?: string;
}

export class InclusionValidator implements Validator {
  constructor(private options: InclusionOptions) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    if (!this.options.in.includes(value)) {
      errors.add(attribute, "inclusion", { message: this.options.message });
    }
  }
}

export interface ExclusionOptions extends ConditionalOptions {
  in: unknown[];
  message?: string;
}

export class ExclusionValidator implements Validator {
  constructor(private options: ExclusionOptions) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    if (this.options.in.includes(value)) {
      errors.add(attribute, "exclusion", { message: this.options.message });
    }
  }
}

export interface FormatOptions extends ConditionalOptions {
  with?: RegExp;
  without?: RegExp;
  message?: string;
}

export class FormatValidator implements Validator {
  constructor(private options: FormatOptions) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    if (value === null || value === undefined) return;
    const str = String(value);
    if (this.options.with && !this.options.with.test(str)) {
      errors.add(attribute, "invalid", { message: this.options.message });
    }
    if (this.options.without && this.options.without.test(str)) {
      errors.add(attribute, "invalid", { message: this.options.message });
    }
  }
}

export interface AcceptanceOptions extends ConditionalOptions {
  accept?: unknown[];
  message?: string;
}

export class AcceptanceValidator implements Validator {
  constructor(private options: AcceptanceOptions = {}) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const accepted = this.options.accept ?? [true, "true", "1", 1, "yes"];
    if (!accepted.includes(value)) {
      errors.add(attribute, "accepted", { message: this.options.message });
    }
  }
}

export interface ConfirmationOptions extends ConditionalOptions {
  message?: string;
}

export class ConfirmationValidator implements Validator {
  constructor(private options: ConfirmationOptions = {}) {}

  validate(record: any, attribute: string, value: unknown, errors: Errors): void {
    if (!shouldValidate(record, this.options)) return;
    const confirmation = record._attributes?.get(`${attribute}_confirmation`) ??
      record[`${attribute}_confirmation`];
    if (confirmation !== undefined && value !== confirmation) {
      errors.add(attribute, "confirmation", { message: this.options.message });
    }
  }
}
