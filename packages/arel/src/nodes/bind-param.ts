import { Node, NodeVisitor } from "./node.js";

/**
 * Represents a bind parameter placeholder in a prepared statement.
 *
 * Mirrors: Arel::Nodes::BindParam
 */
export class BindParam extends Node {
  readonly value: unknown;

  constructor(value?: unknown) {
    super();
    this.value = value;
  }

  valueBeforeTypeCast(): unknown {
    if (
      this.value &&
      typeof this.value === "object" &&
      "valueBeforeTypeCast" in this.value &&
      typeof (this.value as Record<string, unknown>).valueBeforeTypeCast === "function"
    ) {
      return (this.value as { valueBeforeTypeCast(): unknown }).valueBeforeTypeCast();
    }
    return this.value;
  }

  isInfinite(): number | null {
    if (
      this.value &&
      typeof this.value === "object" &&
      "isInfinite" in this.value &&
      typeof (this.value as Record<string, unknown>).isInfinite === "function"
    ) {
      return (this.value as { isInfinite(): number | null }).isInfinite();
    }
    return null;
  }

  isUnboundable(): boolean {
    if (
      this.value &&
      typeof this.value === "object" &&
      "isUnboundable" in this.value &&
      typeof (this.value as Record<string, unknown>).isUnboundable === "function"
    ) {
      return (this.value as { isUnboundable(): boolean }).isUnboundable();
    }
    return false;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
