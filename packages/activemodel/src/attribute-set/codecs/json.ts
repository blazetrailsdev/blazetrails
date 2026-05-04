import type { AttributeSetCodec, AttributeSetEnvelope } from "../coder.js";

export const jsonCodec: AttributeSetCodec = {
  encode(envelope: AttributeSetEnvelope): string {
    return JSON.stringify(envelope);
  },
  decode(input: string): AttributeSetEnvelope {
    return JSON.parse(input) as AttributeSetEnvelope;
  },
};
