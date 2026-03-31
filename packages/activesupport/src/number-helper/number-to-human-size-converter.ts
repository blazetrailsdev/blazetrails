import { NumberConverter } from "./number-converter.js";
import { numberToHumanSize, type NumberToHumanSizeOptions } from "../number-helper.js";

export class NumberToHumanSizeConverter extends NumberConverter<NumberToHumanSizeOptions> {
  convert(): string {
    return numberToHumanSize(this.number, this.options);
  }
}
