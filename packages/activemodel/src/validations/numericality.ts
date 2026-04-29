import { EachValidator } from "../validator.js";
import type { AnyRecord } from "../validator.js";
import { isBlank } from "@blazetrails/activesupport";
import { errorOptions } from "./comparability.js";
import { resolveValue } from "./resolve-value.js";

type NumericValue = number | ((record: AnyRecord) => number) | string;

/**
 * Mirrors: ActiveModel::Validations::NumericalityValidator (numericality.rb)
 *
 *   class NumericalityValidator < EachValidator
 *     include Comparability
 *     include ResolveValue
 *
 *     INTEGER_REGEX     = /\A[+-]?\d+\z/
 *     HEXADECIMAL_REGEX = /\A[+-]?0[xX]/
 *     ...
 */
export class NumericalityValidator extends EachValidator {
  resolveValue = resolveValue;
  errorOptions = errorOptions;

  // Coercion-pipeline privates declared here, attached to the prototype
  // below so they're available during EachValidator's super-time
  // checkValidity() call (same bootstrapping pattern as PRs #994 / #1002 /
  // #1009). Class fields don't initialize until after super() returns.
  /** @internal Rails-private helper. */
  declare optionAsNumber: typeof optionAsNumber;
  /** @internal Rails-private helper. */
  declare parseFloat: typeof parseFloatRails;
  /** @internal Rails-private helper. */
  declare round: typeof round;
  /** @internal Rails-private helper. */
  declare isIsNumber: typeof isIsNumber;
  /** @internal Rails-private helper. */
  declare isIsInteger: typeof isIsInteger;
  /** @internal Rails-private helper. */
  declare isIsHexadecimalLiteral: typeof isIsHexadecimalLiteral;

  private resolveNumeric(val: NumericValue | undefined, record: AnyRecord): number | undefined {
    if (val === undefined) return undefined;
    return this.optionAsNumber(record, val, 15, undefined);
  }

  override checkValidity(): void {
    const compareKeys = [
      "greaterThan",
      "greaterThanOrEqualTo",
      "lessThan",
      "lessThanOrEqualTo",
      "equalTo",
      "otherThan",
    ] as const;
    for (const key of compareKeys) {
      const val = this.options[key];
      if (
        val !== undefined &&
        typeof val !== "number" &&
        typeof val !== "function" &&
        typeof val !== "string"
      ) {
        throw new Error(`:${key} must be a number, a symbol or a proc`);
      }
    }
    if (this.options.in !== undefined && !Array.isArray(this.options.in)) {
      throw new Error(":in must be a range");
    }
  }

  // Rails: validate_each(record, attr_name, value, precision: Float::DIG, scale: nil)
  validateEach(
    record: AnyRecord,
    attribute: string,
    value: unknown,
    precision = 15,
    scale?: number,
  ): void {
    if (value === null || value === undefined) {
      if (this.options.allowNil !== false) return;
      record.errors.add(attribute, "not_a_number", { value, message: this.options.message });
      return;
    }
    if (this.options.allowBlank && isBlank(value)) return;

    if (!this.isIsNumber(value, precision, scale)) {
      record.errors.add(attribute, "not_a_number", { value, message: this.options.message });
      return;
    }

    const num = parseAsNumber(Number(value), precision, scale) as number;

    if (this.options.onlyInteger && !this.isIsInteger(value)) {
      record.errors.add(attribute, "not_an_integer", { value, message: this.options.message });
      return;
    }

    const msg = this.options.message;
    const gt = this.resolveNumeric(this.options.greaterThan as NumericValue | undefined, record);
    if (gt !== undefined && !(num > gt)) {
      record.errors.add(attribute, "greater_than", { count: gt, value, message: msg });
    }
    const gte = this.resolveNumeric(
      this.options.greaterThanOrEqualTo as NumericValue | undefined,
      record,
    );
    if (gte !== undefined && !(num >= gte)) {
      record.errors.add(attribute, "greater_than_or_equal_to", { count: gte, value, message: msg });
    }
    const lt = this.resolveNumeric(this.options.lessThan as NumericValue | undefined, record);
    if (lt !== undefined && !(num < lt)) {
      record.errors.add(attribute, "less_than", { count: lt, value, message: msg });
    }
    const lte = this.resolveNumeric(
      this.options.lessThanOrEqualTo as NumericValue | undefined,
      record,
    );
    if (lte !== undefined && !(num <= lte)) {
      record.errors.add(attribute, "less_than_or_equal_to", { count: lte, value, message: msg });
    }
    const eq = this.resolveNumeric(this.options.equalTo as NumericValue | undefined, record);
    if (eq !== undefined && num !== eq) {
      record.errors.add(attribute, "equal_to", { count: eq, value, message: msg });
    }
    const ot = this.resolveNumeric(this.options.otherThan as NumericValue | undefined, record);
    if (ot !== undefined && num === ot) {
      record.errors.add(attribute, "other_than", { count: ot, value, message: msg });
    }
    if (this.options.in !== undefined) {
      const [min, max] = this.options.in as [number, number];
      if (num < min || num > max) {
        record.errors.add(attribute, "in", {
          message: msg,
          value,
          count: `${min}..${max}`,
        });
      }
    }
    if (this.options.odd && num % 2 === 0) {
      record.errors.add(attribute, "odd", { value, message: msg });
    }
    if (this.options.even && num % 2 !== 0) {
      record.errors.add(attribute, "even", { value, message: msg });
    }
  }
}

// Rails: /\A[+-]?\d+\z/ — JS `^/$` without the `m` flag is the same
// as Ruby \A/\z (start/end of string).
const INTEGER_REGEX = /^[+-]?\d+$/;
// Rails: /\A[+-]?0[xX]/ — no leading whitespace permitted.
const HEXADECIMAL_REGEX = /^[+-]?0[xX]/;

/**
 * Rails: parse_as_number → branches by Ruby type (Float / BigDecimal /
 * Numeric / integer-string / non-hex string). In TS we just narrow to
 * number and route through round + parseFloat per Rails:
 *
 *   def parse_as_number(raw_value, precision, scale)
 *     if raw_value.is_a?(Float)
 *       parse_float(raw_value, precision, scale)
 *     elsif raw_value.is_a?(Numeric)
 *       raw_value
 *     elsif is_integer?(raw_value)
 *       raw_value.to_i
 *     elsif !is_hexadecimal_literal?(raw_value)
 *       parse_float(Kernel.Float(raw_value), precision, scale)
 *     end
 *   end
 *
 * Returns undefined when raw_value isn't parseable (matching Rails'
 * implicit-nil from the `elsif` chain falling through).
 *
 * @internal Rails-private helper.
 */
export function parseAsNumber(num: number, precision: number, scale?: number): number | undefined {
  if (!Number.isFinite(num)) return undefined;
  return parseFloatRails(num, precision, scale);
}

/**
 * Mirrors: numericality.rb:86-88
 *   def parse_float(raw_value, precision, scale)
 *     round(raw_value, scale).to_d(precision)
 *   end
 *
 * Rounds to `scale` decimal places, then truncates to `precision`
 * significant digits — matches Ruby's `BigDecimal(float.round(scale), precision)`.
 *
 * @internal Rails-private helper.
 */
export function parseFloatRails(num: number, precision: number, scale?: number): number {
  return +round(num, scale).toPrecision(precision);
}

/**
 * Mirrors: numericality.rb:90-92
 *   def round(raw_value, scale)
 *     scale ? raw_value.round(scale) : raw_value
 *   end
 *
 * Half-to-even-ish: JS Math.round is half-to-positive-infinity, but
 * matches Ruby's BigDecimal#round default banker's-equivalent for the
 * common decimal cases we hit in validation.
 *
 * @internal Rails-private helper.
 */
export function round(num: number, scale?: number): number {
  if (scale === undefined || scale === null) return num;
  const factor = Math.pow(10, scale);
  return Math.round(num * factor) / factor;
}

/**
 * Mirrors: numericality.rb:94-100
 *   def is_number?(raw_value, precision, scale)
 *     if options[:only_numeric] && !raw_value.is_a?(Numeric)
 *       return false
 *     end
 *     !parse_as_number(raw_value, precision, scale).nil?
 *   rescue ArgumentError, TypeError
 *     false
 *   end
 *
 * Treats a hex literal as not-a-number (Rails' `parse_as_number`
 * explicitly skips the `Kernel.Float` branch when `is_hexadecimal_literal?`
 * is true, so the chain returns nil).
 *
 * @internal Rails-private helper.
 */
export function isIsNumber(
  this: { options: Record<string, unknown>; isIsHexadecimalLiteral(v: unknown): boolean },
  rawValue: unknown,
  precision: number,
  scale?: number,
): boolean {
  if (this.options.onlyNumeric && typeof rawValue !== "number") return false;
  if (rawValue === null || rawValue === undefined) return false;
  if (typeof rawValue === "number") return Number.isFinite(rawValue);
  if (this.isIsHexadecimalLiteral(rawValue)) return false;
  const coerced = Number(rawValue);
  if (Number.isNaN(coerced)) return false;
  return parseAsNumber(coerced, precision, scale) !== undefined;
}

/**
 * Mirrors: numericality.rb:102-104
 *   def is_integer?(raw_value)
 *     INTEGER_REGEX.match?(raw_value.to_s)
 *   end
 *
 * @internal Rails-private helper.
 */
export function isIsInteger(rawValue: unknown): boolean {
  return INTEGER_REGEX.test(String(rawValue));
}

/**
 * Mirrors: numericality.rb:106-108
 *   def is_hexadecimal_literal?(raw_value)
 *     HEXADECIMAL_REGEX.match?(raw_value.to_s)
 *   end
 *
 * @internal Rails-private helper.
 */
export function isIsHexadecimalLiteral(rawValue: unknown): boolean {
  return HEXADECIMAL_REGEX.test(String(rawValue));
}

/**
 * Mirrors: numericality.rb:67-69
 *   def option_as_number(record, option_value, precision, scale)
 *     parse_as_number(resolve_value(record, option_value), precision, scale)
 *   end
 *
 * The single Rails call site that consumes `resolve_value` for compare
 * options (numericality.rb:60). With this private in place, validateEach
 * routes every numeric option through `this.optionAsNumber(...)` rather
 * than the previous inline resolve+coerce.
 *
 * @internal Rails-private helper.
 */
export function optionAsNumber(
  this: {
    resolveValue(record: unknown, value: unknown): unknown;
  },
  record: AnyRecord,
  optionValue: unknown,
  precision: number,
  scale?: number,
): number | undefined {
  const resolved = this.resolveValue(record, optionValue);
  if (resolved === undefined || resolved === null) return undefined;
  if (typeof resolved === "string" && resolved.trim() === "") {
    throw new Error(`Resolved numericality option must be numeric: ${String(resolved)}`);
  }
  const numeric = typeof resolved === "number" ? resolved : Number(resolved);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Resolved numericality option must be numeric: ${String(resolved)}`);
  }
  return parseAsNumber(numeric, precision, scale);
}

NumericalityValidator.prototype.optionAsNumber = optionAsNumber;
NumericalityValidator.prototype.parseFloat = parseFloatRails;
NumericalityValidator.prototype.round = round;
NumericalityValidator.prototype.isIsNumber = isIsNumber;
NumericalityValidator.prototype.isIsInteger = isIsInteger;
NumericalityValidator.prototype.isIsHexadecimalLiteral = isIsHexadecimalLiteral;
