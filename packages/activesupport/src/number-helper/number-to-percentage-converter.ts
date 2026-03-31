import { NumberConverter } from "./number-converter.js";
import { numberToPercentage } from "../number-helper.js";

export class NumberToPercentageConverter extends NumberConverter {
  convert(): string {
    return numberToPercentage(this.number, this.options);
  }
}
