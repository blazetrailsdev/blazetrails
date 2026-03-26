import { EachValidator } from "../validator.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = any;

export class WithValidator extends EachValidator {
  validateEach(record: AnyRecord, attribute: string, _value: unknown): void {
    const methodName = this.options.with as string;
    if (typeof record[methodName] === "function") {
      if (record[methodName].length === 0) {
        record[methodName]();
      } else {
        record[methodName](attribute);
      }
    }
  }
}
