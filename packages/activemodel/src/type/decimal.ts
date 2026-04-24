import { ValueType } from "./value.js";

export class DecimalType extends ValueType<string> {
  readonly name: string = "decimal";

  // JS has no BigDecimal, so we represent decimals as strings to avoid
  // losing precision through IEEE-754 floats. Rails' `cast_value`:
  //   - Numeric  -> BigDecimal(value)
  //   - String   -> value.to_d  (returns BigDecimal(0) on invalid)
  //   - nil      -> nil
  // We mirror the same shape, returning the string form rather than a
  // BigDecimal wrapper.
  cast(value: unknown): string | null {
    const casted = this._castWithoutScale(value);
    return this.applyScale(casted);
  }

  /**
   * Apply Rails' `scale:` option to a decimal string, rounding to the
   * configured number of fractional digits using Ruby's default
   * `BigDecimal#round` mode (`ROUND_HALF_UP` — half away from zero).
   *
   * Mirrors: ActiveModel::Type::Decimal#apply_scale
   * (activemodel/lib/active_model/type/decimal.rb).
   */
  applyScale(value: string | null): string | null {
    if (value === null) return null;
    if (this.scale === undefined) return value;
    return roundHalfUpToScale(value, this.scale);
  }

  private _castWithoutScale(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      // `String(0.1)` -> "0.1" — as precise as JS can represent the
      // input. Callers who need full precision should pass a string.
      return String(value);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      // Rails' `String#to_d` parses a leading numeric prefix and
      // silently drops everything after, returning `BigDecimal(0)` if
      // no leading number is present. Tests assert, e.g.,
      // `"1ignore" -> BigDecimal("1")`, `"bad" -> BigDecimal("0")`.
      const match = trimmed.match(/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/);
      return match ? match[0] : "0";
    }
    return null;
  }

  type(): string {
    return this.name;
  }

  typeCastForSchema(value: unknown): string {
    return JSON.stringify(value) ?? String(value);
  }
}

/**
 * Normalize a decimal-string representation (including scientific notation
 * as emitted by JS `String(1e-7)`) into `sign` + integer + fractional parts.
 */
/**
 * Cap exponent magnitude so adversarial input like `"1e10000000"` can't
 * drive `padEnd`/`padStart` into allocating multi-gigabyte strings. At
 * |exp| > this many digits the value has more precision than any
 * realistic `scale:` will keep anyway; returning null makes `applyScale`
 * leave the raw form alone rather than OOM the process.
 */
const MAX_EXPONENT_EXPANSION = 4000;

function splitDecimal(raw: string): { sign: "" | "-"; intPart: string; fracPart: string } | null {
  let s = raw;
  let sign: "" | "-" = "";
  if (s.startsWith("-")) {
    sign = "-";
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  // Accept the same numeric forms `_castWithoutScale` emits: `1`, `1.`,
  // `.5`, `1.5`, `1e3`, `1.e3`. Reject input with no digits at all.
  const m = s.match(/^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!m) return null;
  if (m[1] === "" && (m[2] ?? "") === "") return null;
  let intPart = m[1] || "0";
  let fracPart = m[2] ?? "";
  const exp = m[3] ? Number(m[3]) : 0;
  if (Math.abs(exp) > MAX_EXPONENT_EXPANSION) return null;
  if (exp > 0) {
    if (fracPart.length >= exp) {
      intPart += fracPart.slice(0, exp);
      fracPart = fracPart.slice(exp);
    } else {
      intPart += fracPart.padEnd(exp, "0");
      fracPart = "";
    }
  } else if (exp < 0) {
    const shift = -exp;
    if (intPart.length > shift) {
      fracPart = intPart.slice(intPart.length - shift) + fracPart;
      intPart = intPart.slice(0, intPart.length - shift);
    } else {
      fracPart = intPart.padStart(shift, "0") + fracPart;
      intPart = "0";
    }
  }
  return { sign, intPart: intPart.replace(/^0+(?=\d)/, "") || "0", fracPart };
}

function roundHalfUpToScale(raw: string, scale: number): string {
  const parts = splitDecimal(raw);
  if (!parts) return raw;
  const { sign, intPart, fracPart } = parts;
  if (fracPart.length <= scale) {
    const padded = scale > 0 ? `.${fracPart.padEnd(scale, "0")}` : "";
    return `${sign}${intPart}${padded}`;
  }
  const keep = fracPart.slice(0, scale);
  const roundDigit = fracPart.charCodeAt(scale) - 48; // '0' → 0
  if (roundDigit < 5) {
    return scale > 0 ? `${sign}${intPart}.${keep}` : `${sign}${intPart}`;
  }
  // Carry: half-away-from-zero bumps magnitude by 1 ulp at position `scale`.
  const digits = (intPart + keep).split("");
  for (let i = digits.length - 1; i >= 0; i--) {
    if (digits[i] === "9") {
      digits[i] = "0";
      if (i === 0) digits.unshift("1");
    } else {
      digits[i] = String(digits[i].charCodeAt(0) - 48 + 1);
      break;
    }
  }
  const out = digits.join("");
  const newIntLen = out.length - scale;
  const newInt = out.slice(0, newIntLen);
  const newFrac = out.slice(newIntLen);
  return scale > 0 ? `${sign}${newInt}.${newFrac}` : `${sign}${newInt}`;
}
