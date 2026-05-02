import { Binary, NotEqual } from "./binary.js";
import type { Node } from "./node.js";

export class Equality extends Binary {
  isEquality(): boolean {
    return true;
  }

  invert(): Node {
    return new NotEqual(this.left, this.right);
  }
}
