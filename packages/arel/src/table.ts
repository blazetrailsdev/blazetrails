import { Attribute } from "./nodes/attribute.js";
import { SqlLiteral } from "./nodes/sql-literal.js";
import { Node, NodeVisitor } from "./nodes/node.js";
import { SelectManager } from "./managers/select-manager.js";
import { InnerJoin, StringJoin } from "./nodes/join.js";
import { On } from "./nodes/unary.js";
import { TableAlias } from "./nodes/with.js";

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

  /**
   * Create an alias for this table.
   *
   * Mirrors: Arel::Table#alias
   */
  alias(name?: string): TableAlias {
    return new TableAlias(this, name ?? `${this.name}_2`);
  }

  /**
   * Factory: create an InnerJoin node.
   *
   * Mirrors: Arel::Table#create_join
   */
  createJoin(to: Node, constraint?: Node): InnerJoin {
    return new InnerJoin(to, constraint ? new On(constraint) : null);
  }

  /**
   * Factory: create a StringJoin node.
   *
   * Mirrors: Arel::Table#create_string_join
   */
  createStringJoin(to: string | Node): StringJoin {
    const node = typeof to === "string" ? new SqlLiteral(to) : to;
    return new StringJoin(node, null);
  }

  /**
   * Factory: create an On node.
   *
   * Mirrors: Arel::Table#create_on
   */
  createOn(expr: Node): On {
    return new On(expr);
  }

  /**
   * Factory: create a TableAlias node.
   *
   * Mirrors: Arel::Table#create_table_alias
   */
  createTableAlias(relation: Node, name: string): TableAlias {
    return new TableAlias(relation, name);
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
