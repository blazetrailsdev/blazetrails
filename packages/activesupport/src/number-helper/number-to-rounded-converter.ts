import { NumberConverter } from "./number-converter.js";
import { numberToRounded, type NumberToRoundedOptions } from "../number-helper.js";

export class NumberToRoundedConverter extends NumberConverter<NumberToRoundedOptions> {
  convert(): string {
    return numberToRounded(this.number, this.options);
  }
}
