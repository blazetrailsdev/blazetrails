import { EachValidator } from "../validator.js";
import type { AnyRecord } from "../validator.js";

/**
 * Manages lazily-defined virtual attributes for acceptance validation.
 * These attributes exist only for validation and aren't persisted.
 *
 * Mirrors: ActiveModel::Validations::AcceptanceValidator::LazilyDefineAttributes
 */
export class LazilyDefineAttributes {
  readonly attributes: readonly string[];

  constructor(attributes: string[]) {
    this.attributes = Object.freeze([...attributes]);
  }

  include(attribute: string): boolean {
    return this.attributes.includes(attribute);
  }

  matches(method: string): string | null {
    return this.include(method) ? method : null;
  }

  define(attribute: string): LazilyDefineAttributes {
    if (this.include(attribute)) return this;
    return new LazilyDefineAttributes([...this.attributes, attribute]);
  }
}

export class AcceptanceValidator extends EachValidator {
  static readonly lazilyDefineAttributes = new LazilyDefineAttributes([]);

  validateEach(record: AnyRecord, attribute: string, value: unknown): void {
    const allowNil = this.options.allowNil ?? true;
    if (allowNil && (value === null || value === undefined)) return;
    // Rails activemodel/lib/active_model/validations/acceptance.rb
    // `acceptable_option?` calls `Array(options[:accept]).include?(value)`,
    // so a scalar `accept:` still works. Normalize here with the same shape.
    const rawAccept = this.options.accept;
    let accepted: unknown[];
    if (rawAccept === undefined) accepted = ["1", true];
    else if (rawAccept === null)
      accepted = []; // Rails `Array(nil) #=> []`
    else if (Array.isArray(rawAccept)) accepted = rawAccept;
    else accepted = [rawAccept];
    if (!accepted.includes(value)) {
      record.errors.add(attribute, "accepted", { message: this.options.message });
    }
  }

  static setup(attributes: string[]): LazilyDefineAttributes {
    return new LazilyDefineAttributes(attributes);
  }
}
