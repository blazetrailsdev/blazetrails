import { NumberConverter } from "./number-converter.js";
import { numberWithDelimiter } from "../number-helper.js";

export class NumberToDelimitedConverter extends NumberConverter {
  convert(): string {
    return numberWithDelimiter(this.number, this.options);
  }
}
