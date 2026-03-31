import { NumberConverter } from "./number-converter.js";
import { numberToHuman, type NumberToHumanOptions } from "../number-helper.js";

export class NumberToHumanConverter extends NumberConverter<NumberToHumanOptions> {
  convert(): string {
    return numberToHuman(this.number, this.options);
  }
}
