import { EachValidator, AnyRecord } from "../validator.js";

export class WithValidator extends EachValidator {
  override checkValidity(): void {
    super.checkValidity();
    const methodName = this.options.with;
    if (typeof methodName !== "string" || methodName.trim().length === 0) {
      throw new globalThis.Error(
        "WithValidator requires the :with option to be a non-blank string",
      );
    }
  }

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
