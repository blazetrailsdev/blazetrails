/**
 * Clusivity — shared logic for inclusion/exclusion validators.
 *
 * Mirrors: ActiveModel::Validations::Clusivity (clusivity.rb)
 *
 * Rails ships Clusivity as a module included by both InclusionValidator
 * and ExclusionValidator. It provides `check_validity!`, the membership
 * test `include?`, the cached `delimiter` accessor, and the
 * `inclusion_method(enumerable)` selector. In TS we expose each as a
 * `this`-typed function that the validator classes attach as prototype
 * methods (matching Rails' `include Clusivity` mixin shape).
 */
import { resolveValue } from "./resolve-value.js";

export { resolveValue };

export const ERROR_MESSAGE =
  "An object with the method #include? or a proc, lambda or symbol is required, " +
  "and must be supplied as the :in (or :within) option of the configuration hash";

export interface Clusivity {
  checkValidity(): void;
  resolveValue(record: unknown, value: unknown): unknown;
  delimiter(): unknown;
  inclusionMethod(enumerable: unknown): "include?" | "cover?";
  isInclude(record: unknown, value: unknown): boolean;
}

interface ClusivityHost {
  options: Record<string, unknown>;
  resolveValue(record: unknown, value: unknown): unknown;
  _delimiterCache?: unknown;
}

/**
 * Mirrors: clusivity.rb:31-33
 *   def delimiter
 *     @delimiter ||= options[:in] || options[:within]
 *   end
 *
 * Memoized so a Proc passed as `:in` / `:within` is captured once
 * per validator instance, matching Rails' `||=` semantics.
 */
export function delimiter(this: ClusivityHost): unknown {
  if (this._delimiterCache !== undefined) return this._delimiterCache;
  this._delimiterCache = this.options.in ?? this.options.within;
  return this._delimiterCache;
}

/**
 * Mirrors: clusivity.rb:40-50
 *
 *   def inclusion_method(enumerable)
 *     if enumerable.is_a? Range
 *       case enumerable.begin || enumerable.end
 *       when Numeric, Time, DateTime, Date then :cover?
 *       else :include?
 *       end
 *     else
 *       :include?
 *     end
 *   end
 *
 * TS has no first-class Range; iterables are treated uniformly as
 * `include?`. If a Range-like type lands later, the cover-vs-include
 * branch slots in here.
 */
export function inclusionMethod(_enumerable: unknown): "include?" | "cover?" {
  return "include?";
}

/**
 * Mirrors: clusivity.rb:21-29
 *   def include?(record, value)
 *     members = resolve_value(record, delimiter)
 *     if value.is_a?(Array)
 *       value.all? { |v| members.public_send(inclusion_method(members), v) }
 *     else
 *       members.public_send(inclusion_method(members), value)
 *     end
 *   end
 *
 * `resolve_value` resolves Procs and Symbol-method references; a string
 * option treated as a method name only if the record responds to it
 * (resolve-value.ts).
 */
export function isInclude(this: ClusivityHost, record: unknown, value: unknown): boolean {
  const members = this.resolveValue(record, delimiter.call(this));
  if (Array.isArray(value)) {
    return value.every((v) => isMemberOf(members, v));
  }
  return isMemberOf(members, value);
}

function isMemberOf(members: unknown, value: unknown): boolean {
  if (Array.isArray(members)) return members.includes(value);
  if (members instanceof Set) return members.has(value);
  if (members && typeof (members as Iterable<unknown>)[Symbol.iterator] === "function") {
    for (const item of members as Iterable<unknown>) {
      if (item === value) return true;
    }
    return false;
  }
  return false;
}

/**
 * Mirrors: clusivity.rb:14-18
 *   def check_validity!
 *     unless delimiter.respond_to?(:include?) || delimiter.respond_to?(:call) || delimiter.respond_to?(:to_sym)
 *       raise ArgumentError, ERROR_MESSAGE
 *     end
 *   end
 *
 * TS analogues for the three Ruby duck checks:
 * - `respond_to?(:include?)` ↔ array / iterable / Set
 * - `respond_to?(:call)` ↔ function
 * - `respond_to?(:to_sym)` ↔ string (resolved via resolveValue at call time)
 */
export function checkValidityBang(this: ClusivityHost): void {
  const d = delimiter.call(this);
  if (d === undefined || d === null) {
    throw new Error(ERROR_MESSAGE);
  }
  const isIterable =
    Array.isArray(d) ||
    d instanceof Set ||
    (typeof d === "object" &&
      d !== null &&
      typeof (d as Record<symbol, unknown>)[Symbol.iterator] === "function");
  const isCallable = typeof d === "function";
  const isSymbolic = typeof d === "string";
  if (!isIterable && !isCallable && !isSymbolic) {
    throw new Error(ERROR_MESSAGE);
  }
}
