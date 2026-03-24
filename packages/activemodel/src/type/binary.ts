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
  readonly value: Uint8Array;
  constructor(value: Uint8Array | string) {
    this.value = typeof value === "string" ? new TextEncoder().encode(value) : value;
  }
}
