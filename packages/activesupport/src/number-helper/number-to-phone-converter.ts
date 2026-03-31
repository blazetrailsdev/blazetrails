import { NumberConverter } from "./number-converter.js";
import { numberToPhone, type NumberToPhoneOptions } from "../number-helper.js";

export class NumberToPhoneConverter extends NumberConverter<NumberToPhoneOptions> {
  convert(): string {
    return numberToPhone(this.number, this.options);
  }
}
