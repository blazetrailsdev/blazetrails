/**
 * Clusivity — shared logic for inclusion/exclusion validators.
 *
 * Mirrors: ActiveModel::Validations::Clusivity (clusivity.rb)
 *
 * Rails ships Clusivity as a module included by both InclusionValidator
 * and ExclusionValidator. It provides `check_validity!`, the membership
 * test `include?`, the cached `delimiter` accessor, and the
 * `inclusion_method(enumerable)` selector. In TS we expose each as a
 * `this`-typed function that the validator classes attach as instance
 * fields, matching Rails' `include Clusivity` mixin shape on a
 * per-instance level (not as prototype overrides — these are fixed
 * Rails helpers, not user-overridable hooks).
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
  if (members === null || members === undefined) return false;
  // String#include? in Ruby is substring match; JS String#includes matches
  // when value is also a string.
  if (typeof members === "string") {
    return typeof value === "string" && members.includes(value);
  }
  // Set / Map both expose .has — for Map this is key membership, matching
  // Ruby's Hash#include?(key). Custom collections that implement .has
  // pick up the same fast path.
  if (members instanceof Set || members instanceof Map) return members.has(value);
  // Array.includes covers Array; many custom collections also expose
  // .includes(item) and behave like Rails' #include?.
  if (Array.isArray(members)) return members.includes(value);
  const m = members as { includes?: (v: unknown) => boolean; has?: (v: unknown) => boolean };
  if (typeof m.includes === "function") return m.includes(value);
  if (typeof m.has === "function") return m.has(value);
  if (typeof (members as Iterable<unknown>)[Symbol.iterator] === "function") {
    for (const item of members as Iterable<unknown>) {
      if (item === value) return true;
    }
    return false;
  }
  return false;
}

/**
 * Rails: `options.except(:in, :within).merge!(value: value)` — passes
 * through every validator option except the collection keys, with the
 * rejected value merged in for i18n interpolation
 * (inclusion.rb:11, exclusion.rb:11).
 */
export function exceptInWithinMergeValue(
  options: Record<string, unknown>,
  value: unknown,
): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(options)) {
    if (key !== "in" && key !== "within") rest[key] = options[key];
  }
  rest.value = value;
  return rest;
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
