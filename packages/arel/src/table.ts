import { Attribute } from "./nodes/attribute.js";
import { SqlLiteral } from "./nodes/sql-literal.js";
import { Node, NodeVisitor } from "./nodes/node.js";
import { SelectManager } from "./managers/select-manager.js";

/**
 * Table — represents a database table.
 *
 * Mirrors: Arel::Table
 */
export class Table extends Node {
  readonly name: string;
  readonly tableAlias: string | null;

  constructor(name: string, options?: { as?: string }) {
    super();
    this.name = name;
    this.tableAlias = options?.as ?? null;
  }

  get(name: string): Attribute {
    return new Attribute(this, name);
  }

  attr(name: string): Attribute {
    return this.get(name);
  }

  project(...projections: (Node | string)[]): SelectManager {
    const manager = new SelectManager(this);
    if (projections.length > 0) {
      manager.project(...projections);
    }
    return manager;
  }

  from(): SelectManager {
    return new SelectManager(this);
  }

  get star(): SqlLiteral {
    return new SqlLiteral(`"${this.name}".*`);
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
