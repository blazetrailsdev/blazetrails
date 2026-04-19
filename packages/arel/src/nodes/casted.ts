import { Node, NodeVisitor } from "./node.js";
import { NodeExpression } from "./node-expression.js";
import type { Attribute } from "../attributes/attribute.js";
import { ATTRIBUTE_BRAND } from "./binary.js";
import { Attribute as AMAttribute } from "@blazetrails/activemodel";

/**
 * Arel::Nodes.build_quoted — coerce `other` into a Node suitable for the AST.
 *
 * Rails: if `other` is already one of the Arel/ActiveModel node-like types,
 * return it unchanged; otherwise wrap it in Casted (when an attribute is
 * provided) or Quoted.
 */
export function buildQuoted(other: unknown, attribute?: unknown): Node {
  if (other instanceof Node) return other;
  if (other && typeof other === "object") {
    // Arel::Attributes::Attribute (duck-typed via symbol brand)
    if ((other as Record<symbol, unknown>)[ATTRIBUTE_BRAND] === true) return other as Node;
    // ActiveModel::Attribute
    if (other instanceof AMAttribute) return other as unknown as Node;
  }
  // SelectManager / Table and other AST-level wrappers expose `.toSql()`;
  // Rails also passes those through. Detect structurally to avoid a hard
  // dep cycle back into ./table.ts / ../select-manager.ts.
  if (
    other &&
    typeof other === "object" &&
    typeof (other as { toSql?: unknown }).toSql === "function"
  ) {
    return other as Node;
  }
  // Lazy-imported to avoid the classic Attribute <-> Casted module cycle.
  if (isAttribute(attribute)) return new Casted(other, attribute as Attribute);
  return new Quoted(other);
}

function isAttribute(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return (value as Record<symbol, unknown>)[ATTRIBUTE_BRAND] === true;
}

/**
 * Casted — a value bound to a specific attribute for type casting.
 *
 * Mirrors: Arel::Nodes::Casted
 */
export class Casted extends NodeExpression {
  readonly value: unknown;
  readonly attribute: Attribute;

  constructor(value: unknown, attribute: Attribute) {
    super();
    this.value = value;
    this.attribute = attribute;
  }

  valueBeforeTypeCast(): unknown {
    return this.value;
  }

  valueForDatabase(): unknown {
    const attr = this.attribute as unknown as {
      caster?: { typeCastForDatabase(v: unknown): unknown };
      isAbleToTypeCast?: () => boolean;
      typeCastForDatabase?: (v: unknown) => unknown;
    };
    if (attr?.caster?.typeCastForDatabase) {
      return attr.caster.typeCastForDatabase(this.value);
    }
    if (attr?.isAbleToTypeCast?.() && attr.typeCastForDatabase) {
      return attr.typeCastForDatabase(this.value);
    }
    return this.value;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}

/**
 * Quoted — a value that will be quoted/escaped in the output SQL.
 *
 * Mirrors: Arel::Nodes::Quoted
 */
export class Quoted extends Node {
  readonly value: unknown;

  constructor(value: unknown) {
    super();
    this.value = value;
  }

  valueForDatabase(): unknown {
    return this.value;
  }

  valueBeforeTypeCast(): unknown {
    return this.value;
  }

  isInfinite(): number | null {
    if (this.value === Infinity) return 1;
    if (this.value === -Infinity) return -1;
    return null;
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
