import { Binary, NotIn } from "./binary.js";
import type { Node } from "./node.js";

export class In extends Binary {
  isEquality(): boolean {
    return true;
  }

  invert(): Node {
    return new NotIn(this.left, this.right);
  }
}
