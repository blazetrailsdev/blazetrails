/**
 * Mirrors: ActiveRecord::Validations::NumericalityValidator
 *
 * Extends ActiveModel's NumericalityValidator to extract column precision
 * and scale from the database schema before validating.
 *
 * Rails passes precision/scale as keyword args to super.validate_each.
 * Our AM base validator doesn't accept those args yet, so we perform an
 * additional schema-based precision check after the base validation runs
 * and add an error when the value exceeds the column limits.
 */
import { NumericalityValidator as BaseNumericalityValidator } from "@blazetrails/activemodel";

// JS Number.MAX_SAFE_INTEGER has 15–16 significant digits. Rails uses
// Float::DIG (15) as the upper bound for precision.
const FLOAT_DIG = 15;

export class NumericalityValidator extends BaseNumericalityValidator {
  validateEach(record: any, attribute: string, value: unknown): void {
    super.validateEach(record, attribute, value);

    const limits = this._columnLimitsFor(record, attribute);
    if (limits == null || value == null || value === "") return;

    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return;

    const violation = this._columnLimitViolation(num, value, limits.precision, limits.scale);
    if (violation == null) return;

    if (violation.kind === "range") {
      record.errors.add(attribute, "less_than_or_equal_to", { count: violation.max, value });
    } else {
      record.errors.add(attribute, "invalid", {
        value,
        message:
          violation.scale === 1
            ? "must have at most 1 decimal place"
            : `must have at most ${violation.scale} decimal places`,
      });
    }
  }

  private _columnLimitViolation(
    num: number,
    rawValue: unknown,
    precision: number | null,
    scale: number | null,
  ): { kind: "range"; max: number } | { kind: "scale"; scale: number } | null {
    if (precision == null) return null;

    const integerDigits = precision - (scale ?? 0);
    const maxIntegerPart = Math.pow(10, integerDigits) - 1;
    const max = maxIntegerPart + (scale != null ? 1 - Math.pow(10, -scale) : 0);

    if (Math.abs(num) > max) {
      return { kind: "range", max };
    }

    if (scale != null) {
      const str = typeof rawValue === "string" ? rawValue : String(num);
      const parts = str.split(".");
      if (parts[1] && parts[1].length > scale) {
        return { kind: "scale", scale };
      }
    }

    return null;
  }

  private _columnLimitsFor(
    record: any,
    attribute: string,
  ): { precision: number | null; scale: number | null } | null {
    const klass = record.constructor;
    if (typeof klass.typeForAttribute !== "function") return null;
    const type = klass.typeForAttribute(attribute);
    if (!type) return null;

    const rawPrecision: number | null = type.precision ?? null;
    const rawScale: number | null = type.scale ?? null;
    if (rawPrecision == null && rawScale == null) return null;

    return {
      // Rails: [column_precision_for(record, attribute) || Float::DIG, Float::DIG].min
      precision: Math.min(rawPrecision ?? FLOAT_DIG, FLOAT_DIG),
      scale: rawScale,
    };
  }
}
