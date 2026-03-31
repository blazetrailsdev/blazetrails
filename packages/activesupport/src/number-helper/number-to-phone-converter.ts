import { NumberConverter } from "./number-converter.js";
import { numberToPhone } from "../number-helper.js";

export class NumberToPhoneConverter extends NumberConverter {
  convert(): string {
    return numberToPhone(this.number, this.options);
  }
}
