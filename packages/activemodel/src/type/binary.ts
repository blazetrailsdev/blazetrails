import { Type } from "./value.js";

const textEncoder = new TextEncoder();

export class BinaryType extends Type<Uint8Array> {
  readonly name = "binary";

  cast(value: unknown): Uint8Array | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Uint8Array) return value;
    return textEncoder.encode(String(value));
  }

  serialize(value: unknown): Uint8Array | null {
    return this.cast(value);
  }
}

export class Data {
  readonly value: string;

  constructor(value: string | Uint8Array) {
    this.value = typeof value === "string" ? value : new TextDecoder().decode(value);
  }

  toString(): string {
    return this.value;
  }

  byteSize(): number {
    return new TextEncoder().encode(this.value).length;
  }

  hex(): string {
    return Array.from(new TextEncoder().encode(this.value))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
