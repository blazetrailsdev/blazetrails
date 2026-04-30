import { EachValidator } from "../validator.js";
import type { AnyRecord } from "../validator.js";

/**
 * Manages lazily-defined virtual attributes for acceptance validation.
 * These attributes exist only for validation and aren't persisted.
 *
 * Mirrors: ActiveModel::Validations::AcceptanceValidator::LazilyDefineAttributes
 */
export class LazilyDefineAttributes {
  /** @internal */
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

/**
 * Ruby `Array()` coerces any object with `to_a`/`to_ary` (Set, Enumerator,
 * Hash, etc.) into an array, but leaves strings wrapped as `[str]`. Match
 * that: if the value is iterable but not a string, spread it.
 */
function isNonStringIterable(value: unknown): value is Iterable<unknown> {
  if (typeof value !== "object" || value === null) return false;
  // Boxed strings (`new String("yes")`) are iterable by char; Ruby's
  // `Array("yes")` still wraps as `["yes"]`, so treat them as scalars.
  if (value instanceof String) return false;
  return typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function";
}

export class AcceptanceValidator extends EachValidator {
  static readonly lazilyDefineAttributes = new LazilyDefineAttributes([]);

  /** @internal Rails-private helper. */
  declare setupBang: typeof setupBang;
  /** @internal Rails-private helper. */
  declare isAcceptableOption: typeof isAcceptableOption;

  validateEach(record: AnyRecord, attribute: string, value: unknown): void {
    const allowNil = this.options.allowNil ?? true;
    if (allowNil && (value === null || value === undefined)) return;
    if (!this.isAcceptableOption(value)) {
      record.errors.add(attribute, "accepted", { message: this.options.message });
    }
  }

  static setup(attributes: string[]): LazilyDefineAttributes {
    return new LazilyDefineAttributes(attributes);
  }
}

interface AcceptanceHost {
  attributes: readonly string[];
}

/**
 * Mirrors: acceptance.rb:18-22
 *   def setup!(klass)
 *     define_attributes = LazilyDefineAttributes.new(attributes)
 *     klass.include(define_attributes) unless klass.included_modules.include?(define_attributes)
 *   end
 *
 * Rails lazily materializes attr_reader/attr_writer for the acceptance
 * attributes on first access via method_missing. Trails has no
 * method_missing, so install accessors eagerly on the prototype with
 * a per-instance backing slot. Skips attributes the host already
 * defines.
 *
 * @internal Rails-private helper.
 */
export function setupBang(this: AcceptanceHost, klass: unknown): void {
  if (typeof klass !== "function") return;
  const ctor = klass as { prototype: object };
  for (const attribute of this.attributes) {
    const inherited = inspectAccessor(ctor.prototype, attribute);
    if (inherited.hasGetter && inherited.hasSetter) continue;
    const slot = `_${attribute}`;
    // Rails checks reader and writer separately (attribute_method?(name)
    // vs attribute_method?("#{name}=")). Install only the missing half.
    // When one side IS inherited (anywhere in the prototype chain),
    // reuse it on the new descriptor so overriding doesn't shadow it.
    Object.defineProperty(ctor.prototype, attribute, {
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
 * Mirrors: acceptance.rb:24-26
 *   def acceptable_option?(value)
 *     Array(options[:accept]).include?(value)
 *   end
 *
 * Rails `Array(options[:accept])` coerces missing → []; scalar → [s];
 * iterable → flattened. Rails checks `options.key?(:accept)` separately
 * at the constructor (defaults to `["1", true]` when missing). This
 * port keeps both behaviors: when the key isn't set the default
 * applies; when set, explicit `null` collapses to `[]`.
 *
 * @internal Rails-private helper.
 */
export function isAcceptableOption(
  this: { options: Record<string, unknown> },
  value: unknown,
): boolean {
  const hasAccept = Object.prototype.hasOwnProperty.call(this.options, "accept");
  let accepted: unknown[];
  if (!hasAccept) accepted = ["1", true];
  else {
    const rawAccept = this.options.accept;
    if (rawAccept === null || rawAccept === undefined) accepted = [];
    else if (Array.isArray(rawAccept)) accepted = rawAccept;
    else if (isNonStringIterable(rawAccept)) accepted = Array.from(rawAccept);
    else accepted = [rawAccept];
  }
  return accepted.includes(value);
}

AcceptanceValidator.prototype.setupBang = setupBang;
AcceptanceValidator.prototype.isAcceptableOption = isAcceptableOption;
