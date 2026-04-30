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
    const inherited = inspectAccessor(ctor.prototype, confirmationAttr);
    if (inherited.hasGetter && inherited.hasSetter) continue;
    const slot = `_${confirmationAttr}`;
    // Rails checks reader and writer separately (method_defined? for
    // both `:#{a}_confirmation` and `:#{a}_confirmation=`). Install
    // only the missing half. When one side IS inherited (anywhere in
    // the prototype chain), reuse it on the new descriptor so
    // overriding doesn't shadow it.
    Object.defineProperty(ctor.prototype, confirmationAttr, {
      configurable: true,
      get:
        inherited.getter ??
        function (this: Record<string, unknown>) {
          return this[slot] as unknown;
        },
      set:
        inherited.setter ??
        function (this: Record<string, unknown>, v: unknown) {
          this[slot] = v;
        },
    });
  }
}

interface InheritedAccessor {
  hasGetter: boolean;
  hasSetter: boolean;
  getter?: (this: object) => unknown;
  setter?: (this: object, value: unknown) => void;
}

/**
 * Walk the prototype chain and capture the first-found accessor
 * shape for `name`. Distinguishes accessor descriptors (`get`/`set`)
 * from data descriptors (`"value" in desc` — handles the
 * `value: undefined` case correctly) and synthesizes a getter/setter
 * pair from a data property so callers can preserve it in a new
 * accessor descriptor.
 */
function inspectAccessor(prototype: object, name: string): InheritedAccessor {
  let proto: object | null = prototype;
  while (proto && proto !== Object.prototype) {
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (desc) {
      if ("value" in desc || "writable" in desc) {
        // Plain data property — synthesize a getter/setter pair that
        // mirrors the inherited slot semantics.
        return {
          hasGetter: true,
          hasSetter: desc.writable !== false,
          getter() {
            return (this as Record<string, unknown>)[name];
          },
          setter:
            desc.writable !== false
              ? function (this: object, v: unknown) {
                  (this as Record<string, unknown>)[name] = v;
                }
              : undefined,
        };
      }
      return {
        hasGetter: typeof desc.get === "function",
        hasSetter: typeof desc.set === "function",
        getter: desc.get as ((this: object) => unknown) | undefined,
        setter: desc.set as ((this: object, v: unknown) => void) | undefined,
      };
    }
    proto = Object.getPrototypeOf(proto);
  }
  return { hasGetter: false, hasSetter: false };
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
