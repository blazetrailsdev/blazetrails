import { NumberConverter } from "./number-converter.js";
import { numberToCurrency, type NumberToCurrencyOptions } from "../number-helper.js";

export class NumberToCurrencyConverter extends NumberConverter<NumberToCurrencyOptions> {
  convert(): string {
    return numberToCurrency(this.number, this.options);
  }
}
