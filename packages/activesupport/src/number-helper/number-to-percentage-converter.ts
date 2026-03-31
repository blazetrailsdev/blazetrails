import { NumberConverter } from "./number-converter.js";
import { numberToPercentage, type NumberToPercentageOptions } from "../number-helper.js";

export class NumberToPercentageConverter extends NumberConverter<NumberToPercentageOptions> {
  convert(): string {
    return numberToPercentage(this.number, this.options);
  }
}
