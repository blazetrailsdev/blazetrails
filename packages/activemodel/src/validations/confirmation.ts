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
    const { hasGetter, hasSetter } = inspectAccessor(ctor.prototype, confirmationAttr);
    if (hasGetter && hasSetter) continue;
    const slot = `_${confirmationAttr}`;
    // Rails checks reader and writer separately (method_defined? for
    // both `:#{a}_confirmation` and `:#{a}_confirmation=`). Mirror by
    // installing only the missing half so a host that pre-defined one
    // accessor isn't overridden.
    const existing = Object.getOwnPropertyDescriptor(ctor.prototype, confirmationAttr);
    Object.defineProperty(ctor.prototype, confirmationAttr, {
      configurable: true,
      get:
        existing?.get ??
        function (this: Record<string, unknown>) {
          return this[slot] as unknown;
        },
      set:
        existing?.set ??
        function (this: Record<string, unknown>, v: unknown) {
          this[slot] = v;
        },
    });
  }
}

function inspectAccessor(
  prototype: object,
  name: string,
): { hasGetter: boolean; hasSetter: boolean } {
  let proto: object | null = prototype;
  let hasGetter = false;
  let hasSetter = false;
  while (proto && proto !== Object.prototype) {
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (desc) {
      if (desc.get || desc.value !== undefined) hasGetter = true;
      if (desc.set || desc.writable) hasSetter = true;
      // Plain data properties act as both reader and writer; either way
      // we've found what's defined at this level — stop walking.
      break;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return { hasGetter, hasSetter };
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
