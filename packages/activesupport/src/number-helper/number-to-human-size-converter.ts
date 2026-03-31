import { NumberConverter } from "./number-converter.js";
import { numberToHumanSize } from "../number-helper.js";

export class NumberToHumanSizeConverter extends NumberConverter {
  convert(): string {
    return numberToHumanSize(this.number, this.options);
  }
}
