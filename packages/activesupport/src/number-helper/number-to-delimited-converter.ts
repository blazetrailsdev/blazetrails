import { NumberConverter } from "./number-converter.js";
import { numberWithDelimiter, type NumberWithDelimiterOptions } from "../number-helper.js";

export class NumberToDelimitedConverter extends NumberConverter<NumberWithDelimiterOptions> {
  convert(): string {
    return numberWithDelimiter(this.number, this.options);
  }
}
