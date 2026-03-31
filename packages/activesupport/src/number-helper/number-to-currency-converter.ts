import { NumberConverter } from "./number-converter.js";
import { numberToCurrency } from "../number-helper.js";

export class NumberToCurrencyConverter extends NumberConverter {
  convert(): string {
    return numberToCurrency(this.number, this.options);
  }
}
