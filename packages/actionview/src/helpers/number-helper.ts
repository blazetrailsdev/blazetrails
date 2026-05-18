/**
 * ActionView::Helpers::NumberHelper — thin wrappers around `@blazetrails/activesupport`
 * NumberHelper that add `raise: true`, HTML-escaping of user-supplied format options,
 * and html_safe marking when the input parses as a number or is already html_safe.
 */

import {
  NumberHelper,
  SafeBuffer,
  htmlEscape,
  htmlSafe,
  isHtmlSafe,
} from "@blazetrails/activesupport";

export class InvalidNumberError extends Error {
  number: unknown;
  constructor(number: unknown) {
    super(String(number));
    this.name = "InvalidNumberError";
    this.number = number;
  }
}

export interface NumberHelperOptions {
  format?: string | SafeBuffer;
  negativeFormat?: string | SafeBuffer;
  separator?: string | SafeBuffer;
  delimiter?: string | SafeBuffer;
  unit?: string | SafeBuffer;
  units?: Record<string, string | SafeBuffer>;
  raise?: boolean;
  precision?: number;
  significant?: boolean;
  stripInsignificantZeros?: boolean;
  areaCode?: boolean;
  extension?: string | number;
  countryCode?: string | number;
  [key: string]: unknown;
}

type NumberLike = number | string | SafeBuffer | null | undefined;

const ESCAPE_KEYS = ["format", "negativeFormat", "separator", "delimiter"] as const;

function escapeUnsafeOptions(options: NumberHelperOptions): NumberHelperOptions {
  const out: NumberHelperOptions = { ...options };
  for (const k of ESCAPE_KEYS) {
    if (out[k] !== undefined) out[k] = htmlEscape(out[k]).toString();
  }
  if (out.unit !== undefined) {
    out.unit = isHtmlSafe(out.unit)
      ? (out.unit as SafeBuffer).toString()
      : htmlEscape(out.unit).toString();
  }
  if (out.units && typeof out.units === "object") {
    const escaped: Record<string, string> = {};
    for (const [k, v] of Object.entries(out.units)) escaped[k] = htmlEscape(v).toString();
    out.units = escaped;
  }
  return out;
}

function parseFloatStrict(number: unknown): number | null {
  if (number == null) return null;
  if (typeof number === "number") return Number.isFinite(number) ? number : null;
  if (typeof number === "boolean") return null;
  const str =
    number instanceof SafeBuffer ? number.toString() : typeof number === "string" ? number : null;
  if (str === null) return null;
  const trimmed = str.trim();
  // Ruby's Float() rejects strings with trailing junk; mimic with a strict numeric regex.
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const isValidFloat = (n: unknown) => parseFloatStrict(n) !== null;

function wrap(number: unknown, raiseOnInvalid: boolean, formatted: string): string | SafeBuffer {
  const valid = isValidFloat(number);
  if (raiseOnInvalid && !valid) throw new InvalidNumberError(number);
  return valid || isHtmlSafe(number) ? htmlSafe(formatted) : formatted;
}

const asArg = (n: NumberLike): unknown => (n instanceof SafeBuffer ? n.toString() : n);

export function numberToPhone(
  number: NumberLike,
  options: NumberHelperOptions = {},
): string | SafeBuffer | null {
  if (number == null) return null;
  const { raise: raiseOnInvalid, ...rest } = options;
  if (raiseOnInvalid && !isValidFloat(number)) throw new InvalidNumberError(number);
  const opts: Record<string, unknown> = { ...rest };
  if (opts.delimiter instanceof SafeBuffer) opts.delimiter = opts.delimiter.toString();
  return htmlEscape(NumberHelper.numberToPhone(asArg(number), opts));
}

function delegate(
  method: (n: unknown, o: Record<string, unknown>) => string,
  number: NumberLike,
  options: NumberHelperOptions,
): string | SafeBuffer | null {
  if (number == null) return null;
  const { raise: raiseOnInvalid, ...rest } = escapeUnsafeOptions(options);
  return wrap(number, !!raiseOnInvalid, method(asArg(number), rest as Record<string, unknown>));
}

export const numberToCurrency = (n: NumberLike, o: NumberHelperOptions = {}) =>
  delegate(NumberHelper.numberToCurrency, n, o);
export const numberToPercentage = (n: NumberLike, o: NumberHelperOptions = {}) =>
  delegate(NumberHelper.numberToPercentage, n, o);
export const numberWithDelimiter = (n: NumberLike, o: NumberHelperOptions = {}) =>
  delegate(NumberHelper.numberWithDelimiter, n, o);
export const numberWithPrecision = (n: NumberLike, o: NumberHelperOptions = {}) =>
  delegate(NumberHelper.numberToRounded, n, o);
export const numberToHumanSize = (n: NumberLike, o: NumberHelperOptions = {}) =>
  delegate(NumberHelper.numberToHumanSize, n, o);
export const numberToHuman = (n: NumberLike, o: NumberHelperOptions = {}) =>
  delegate(NumberHelper.numberToHuman, n, o);
