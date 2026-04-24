import { ImmutableStringType } from "./immutable-string.js";

export class StringType extends ImmutableStringType {
  readonly name: string = "string";

  cast(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    // StringType inherits the boolean-literal casting from
    // ImmutableStringType (type/string.rb subclasses immutable_string.rb):
    // `true` -> "t", `false` -> "f".
    if (value === true) return "t";
    if (value === false) return "f";
    return String(value);
  }

  // Return type stays `unknown` so subclass overrides (e.g. PG OID's
  // Xml which wraps the cast result in a Data node) can widen the
  // output type the way Rails' loosely-typed `serialize` does.
  serialize(value: unknown): unknown {
    return this.cast(value);
  }

  isChangedInPlace(rawOldValue: unknown, newValue: unknown): boolean {
    if (rawOldValue === null || rawOldValue === undefined)
      return newValue !== null && newValue !== undefined;
    return String(rawOldValue) !== String(newValue);
  }

  toImmutableString(): ImmutableStringType {
    return new ImmutableStringType({
      precision: this.precision,
      scale: this.scale,
      limit: this.limit,
    });
  }
}
