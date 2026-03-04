import { Node } from "../nodes/node.js";
import { InsertStatement } from "../nodes/insert-statement.js";
import { Attribute } from "../nodes/attribute.js";
import { ValuesList } from "../nodes/values-list.js";
import { Quoted } from "../nodes/quoted.js";
import { Table } from "../table.js";
import { ToSql } from "../visitors/to-sql.js";

/**
 * InsertManager — chainable API for building INSERT statements.
 *
 * Mirrors: Arel::InsertManager
 */
export class InsertManager {
  readonly ast: InsertStatement;

  constructor() {
    this.ast = new InsertStatement();
  }

  /**
   * Set the target table.
   */
  into(table: Table): this {
    this.ast.relation = table;
    return this;
  }

  /**
   * Set column/value pairs.
   */
  insert(values: [Attribute | Node, unknown][]): this {
    const columns: Node[] = [];
    const row: Node[] = [];
    for (const [col, val] of values) {
      columns.push(col);
      row.push(val instanceof Node ? val : new Quoted(val));
    }
    this.ast.columns = columns;
    this.ast.values = new ValuesList([row]);
    return this;
  }

  /**
   * Set values from raw rows.
   */
  values(valuesList: ValuesList): this {
    this.ast.values = valuesList;
    return this;
  }

  /**
   * Generate SQL string.
   */
  toSql(): string {
    return new ToSql().compile(this.ast);
  }
}
