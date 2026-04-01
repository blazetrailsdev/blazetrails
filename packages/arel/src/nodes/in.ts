import { Binary, NotIn } from "./binary.js";
import type { Node } from "./node.js";
import type { Attribute } from "../attributes/attribute.js";

export class In extends Binary {
  isEquality(): boolean {
    return true;
  }

  invert(): Node {
    return new NotIn(this.left, this.right);
  }

  fetchAttribute(block: (attr: Node) => unknown): unknown {
    if (isAttribute(this.left)) return block(this.left as Node);
    if (isAttribute(this.right)) return block(this.right as Node);
    return undefined;
  }
}

function isAttribute(node: unknown): node is Attribute {
  if (!node || typeof node !== "object") return false;
  const obj = node as Record<string, unknown>;
  return "relation" in obj && "name" in obj && typeof obj.name === "string";
}
