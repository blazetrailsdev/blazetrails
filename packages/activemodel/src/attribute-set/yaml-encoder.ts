import { AttributeSet } from "./builder.js";

export class YAMLEncoder {
  encode(set: AttributeSet): string {
    return JSON.stringify(set.toHash());
  }

  decode(encoded: string): Record<string, unknown> {
    return JSON.parse(encoded);
  }

  types(): Record<string, string> {
    return {};
  }
}
