import { EachValidator } from "../validator.js";
import type { AnyRecord } from "../validator.js";
import { humanize } from "@blazetrails/activesupport";

/**
 * Mirrors: ActiveModel::Validations::ConfirmationValidator (confirmation.rb)
 */
export class ConfirmationValidator extends EachValidator {
  /** @internal Rails-private helper. */
  declare setupBang: typeof setupBang;
  /** @internal Rails-private helper. */
  declare isConfirmationValueEqual: typeof isConfirmationValueEqual;

  validateEach(record: AnyRecord, attribute: string, value: unknown): void {
    const confirmationAttr = `${attribute}Confirmation`;
    const confirmation = record.readAttribute?.(confirmationAttr) ?? record[confirmationAttr];
    if (confirmation == null) return;
    if (!this.isConfirmationValueEqual(record, attribute, value, confirmation)) {
      const modelClass = (record as AnyRecord).constructor;
      const humanAttr = modelClass?.humanAttributeName
        ? modelClass.humanAttributeName(attribute)
        : humanize(attribute);
      record.errors.add(confirmationAttr, "confirmation", {
        message: this.options.message,
        attribute: humanAttr,
      });
    }
  }
}

interface ConfirmationHost {
  attributes: readonly string[];
}

/**
 * Mirrors: confirmation.rb:21-29
 *   def setup!(klass)
 *     klass.attr_reader(*attributes.filter_map { |a| :"#{a}_confirmation" unless klass.method_defined?(:"#{a}_confirmation") })
 *     klass.attr_writer(*attributes.filter_map { |a| :"#{a}_confirmation" unless klass.method_defined?(:"#{a}_confirmation=") })
 *   end
 *
 * Defines virtual `${attribute}Confirmation` reader/writer accessors on
 * the host class so the comparison side of the pair is reachable. In
 * trails the validator already falls back to `record[confirmationAttr]`
 * via the existing direct property access path; this helper materializes
 * matching prototype accessors when a host class explicitly opts in,
 * keeping a per-instance backing slot under `_${attr}Confirmation`.
 *
 * @internal Rails-private helper.
 */
export function setupBang(this: ConfirmationHost, klass: unknown): void {
  if (typeof klass !== "function") return;
  const ctor = klass as { prototype: object };
  for (const attribute of this.attributes) {
    const confirmationAttr = `${attribute}Confirmation`;
    if (confirmationAttr in ctor.prototype) continue;
    const slot = `_${confirmationAttr}`;
    Object.defineProperty(ctor.prototype, confirmationAttr, {
      configurable: true,
      get(this: Record<string, unknown>) {
        return this[slot] as unknown;
      },
      set(this: Record<string, unknown>, v: unknown) {
        this[slot] = v;
      },
    });
  }
}

/**
 * Mirrors: confirmation.rb:32-38
 *   def confirmation_value_equal?(record, attribute, value, confirmed)
 *     if !options[:case_sensitive] && value.is_a?(String)
 *       value.casecmp(confirmed) == 0
 *     else
 *       value == confirmed
 *     end
 *   end
 *
 * @internal Rails-private helper.
 */
export function isConfirmationValueEqual(
  this: { options: Record<string, unknown> },
  _record: AnyRecord,
  _attribute: string,
  value: unknown,
  confirmed: unknown,
): boolean {
  const caseSensitive = this.options.caseSensitive ?? true;
  if (!caseSensitive && typeof value === "string" && typeof confirmed === "string") {
    return value.toLowerCase() === confirmed.toLowerCase();
  }
  return value === confirmed;
}

ConfirmationValidator.prototype.setupBang = setupBang;
ConfirmationValidator.prototype.isConfirmationValueEqual = isConfirmationValueEqual;
