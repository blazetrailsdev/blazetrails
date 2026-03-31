import { NumberConverter } from "./number-converter.js";
import { NumberToRoundedConverter } from "./number-to-rounded-converter.js";
import type { NumberToCurrencyOptions } from "../number-helper.js";

export class NumberToCurrencyConverter extends NumberConverter<NumberToCurrencyOptions> {
  protected convert(): string {
    const {
      precision = 2,
      unit = "$",
      separator = ".",
      delimiter = ",",
      negativeFormat = "(%u%n)",
    } = this.opts;
    const userFormat = this.opts.format;

    const num = Number(this.number);
    if (isNaN(num)) return String(this.number);

    const isNegative = num < 0;
    const abs = Math.abs(num);

    const numberStr = NumberToRoundedConverter.convert(abs, {
      precision,
      separator,
      delimiter,
    });

    if (userFormat !== undefined) {
      const numStr = isNegative ? `-${numberStr}` : numberStr;
      return userFormat.replace("%u", unit).replace("%n", numStr);
    }

    const format = isNegative ? negativeFormat : "%u%n";
    return format.replace("%u", unit).replace("%n", numberStr);
  }
}
