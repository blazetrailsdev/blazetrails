import YAML from "yaml";
import { AttributeSet } from "./builder.js";

/**
 * Encodes and decodes an AttributeSet to/from YAML.
 *
 * Mirrors: ActiveModel::AttributeSet::YAMLEncoder
 */
export class YAMLEncoder {
  encode(set: AttributeSet): string {
    return YAML.stringify(set.toHash());
  }

  decode(encoded: string): Record<string, unknown> {
    return YAML.parse(encoded) as Record<string, unknown>;
  }

  types(): Record<string, string> {
    return {};
  }
}
