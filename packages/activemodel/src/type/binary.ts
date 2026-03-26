import { Type } from "./value.js";

const textEncoder = new TextEncoder();

export class BinaryType extends Type<Uint8Array> {
  readonly name = "binary";

  cast(value: unknown): Uint8Array | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Data) return textEncoder.encode(value.value);
    if (value instanceof Uint8Array) return value;
    return textEncoder.encode(String(value));
  }

  serialize(value: unknown): Uint8Array | null {
    return this.cast(value);
  }

  deserialize(value: unknown): Uint8Array | null {
    if (value instanceof Data) return textEncoder.encode(value.value);
    return this.cast(value);
  }
}

/**
 * Wraps binary data with utility methods.
 *
 * Mirrors: ActiveModel::Type::Binary::Data
 */
export class Data {
  readonly value: string;

  constructor(value: string | Uint8Array) {
    this.value = typeof value === "string" ? value : new TextDecoder().decode(value);
  }

  toString(): string {
    return this.value;
  }

  byteSize(): number {
    return textEncoder.encode(this.value).length;
  }

  hex(): string {
    return Array.from(textEncoder.encode(this.value))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
