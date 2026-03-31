import { NumberConverter } from "./number-converter.js";
import { numberToRounded } from "../number-helper.js";

export class NumberToRoundedConverter extends NumberConverter {
  convert(): string {
    return numberToRounded(this.number, this.options);
  }
}
