import { Node, NodeVisitor } from "./node.js";
import { SqlLiteral } from "./sql-literal.js";
import { Cte } from "./cte.js";

export class TableAlias extends Node {
  readonly relation: Node;
  readonly name: string;

  constructor(relation: Node, name: string) {
    super();
    this.relation = relation;
    this.name = name;
  }

  get(columnName: string): Node {
    return new SqlLiteral(`"${this.name}"."${columnName}"`);
  }

  get tableName(): string {
    if (this.relation && typeof (this.relation as unknown as { name: string }).name === "string") {
      return (this.relation as unknown as { name: string }).name;
    }
    return this.name;
  }

  typeCastForDatabase(attrName: string, value: unknown): unknown {
    if (
      typeof (this.relation as unknown as { typeCastForDatabase: (...args: unknown[]) => unknown })
        .typeCastForDatabase === "function"
    ) {
      return (
        this.relation as unknown as { typeCastForDatabase: (a: string, v: unknown) => unknown }
      ).typeCastForDatabase(attrName, value);
    }
    return value;
  }

  typeForAttribute(name: string): unknown {
    if (
      typeof (this.relation as unknown as { typeForAttribute: (n: string) => unknown })
        .typeForAttribute === "function"
    ) {
      return (
        this.relation as unknown as { typeForAttribute: (n: string) => unknown }
      ).typeForAttribute(name);
    }
    return undefined;
  }

  isAbleToTypeCast(): boolean {
    if (
      this.relation &&
      typeof (this.relation as unknown as { isAbleToTypeCast: () => boolean }).isAbleToTypeCast ===
        "function"
    ) {
      return (this.relation as unknown as { isAbleToTypeCast: () => boolean }).isAbleToTypeCast();
    }
    return false;
  }

  toCte(): Cte {
    return new Cte(this.name, this.relation);
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
