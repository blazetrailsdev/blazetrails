import { Node, NodeVisitor } from "./node.js";

export class HomogeneousIn extends Node {
  readonly attribute: Node;
  readonly values: unknown[];
  readonly type: "in" | "notin";

  constructor(values: unknown[], attribute: Node, type: "in" | "notin") {
    super();
    this.values = values;
    this.attribute = attribute;
    this.type = type;
  }

  isEquality(): boolean {
    return this.type === "in";
  }

  invert(): HomogeneousIn {
    return new HomogeneousIn(this.values, this.attribute, this.type === "in" ? "notin" : "in");
  }

  get left(): Node {
    return this.attribute;
  }

  get right(): unknown {
    return this.values;
  }

  get castedValues(): unknown[] {
    return this.values;
  }

  get procForBinds(): ((value: unknown) => unknown) | null {
    return null;
  }

  fetchAttribute(block: (attr: Node) => unknown): unknown {
    if (this.attribute) return block(this.attribute);
    return undefined;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
