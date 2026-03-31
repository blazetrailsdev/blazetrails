import { NumberConverter } from "./number-converter.js";
import { numberToHuman } from "../number-helper.js";

export class NumberToHumanConverter extends NumberConverter {
  convert(): string {
    return numberToHuman(this.number, this.options);
  }
}
