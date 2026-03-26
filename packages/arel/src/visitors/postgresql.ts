import { Node } from "../nodes/node.js";
import * as Nodes from "../nodes/index.js";
import { SQLString } from "../collectors/sql-string.js";
import { ToSql } from "./to-sql.js";

/**
 * PostgreSQL visitor — extends generic ToSql with PostgreSQL-specific features.
 *
 * Mirrors: Arel::Visitors::PostgreSQL
 */
export class PostgreSQL extends ToSql {
  protected override visitDistinctOn(node: Nodes.DistinctOn): SQLString {
    this.collector.append("DISTINCT ON (");
    if (node.expr instanceof Node) {
      this.visit(node.expr);
    } else if (node.expr !== null) {
      this.collector.append(String(node.expr));
    }
    this.collector.append(")");
    return this.collector;
  }

  protected override visitMatches(node: Nodes.Matches): SQLString {
    this.visitNodeOrValue(node.left);
    this.collector.append(node.caseSensitive ? " LIKE " : " ILIKE ");
    this.visitNodeOrValue(node.right);
    if (node.escape) {
      this.collector.append(` ESCAPE '${node.escape}'`);
    }
    return this.collector;
  }

  protected override visitDoesNotMatch(node: Nodes.DoesNotMatch): SQLString {
    this.visitNodeOrValue(node.left);
    this.collector.append(node.caseSensitive ? " NOT LIKE " : " NOT ILIKE ");
    this.visitNodeOrValue(node.right);
    if (node.escape) {
      this.collector.append(` ESCAPE '${node.escape}'`);
    }
    return this.collector;
  }

  protected override visitRegexp(node: Nodes.Regexp): SQLString {
    return this.visitBinaryOp(node, node.caseSensitive ? "~" : "~*");
  }

  protected override visitNotRegexp(node: Nodes.NotRegexp): SQLString {
    return this.visitBinaryOp(node, node.caseSensitive ? "!~" : "!~*");
  }

  protected override quote(value: unknown): string {
    if (Array.isArray(value)) {
      const arrayLiteral = this.quoteArrayLiteral(value);
      return `'${arrayLiteral.replace(/'/g, "''")}'`;
    }
    return super.quote(value);
  }

  private quoteArrayLiteral(arr: unknown[]): string {
    const elements = arr.map((v) => {
      if (v === null || v === undefined) return "NULL";
      if (Array.isArray(v)) return this.quoteArrayLiteral(v);
      if (typeof v === "number") return String(v);
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      if (v instanceof Date) {
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, "0");
        const d = String(v.getDate()).padStart(2, "0");
        return `"${y}-${m}-${d}"`;
      }
      const str = String(v);
      const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    return `{${elements.join(",")}}`;
  }
}

/**
 * PostgreSQL visitor — uses numbered bind parameters ($1, $2, ...).
 */
export class PostgreSQLWithBinds extends PostgreSQL {
  private bindIndex = 0;

  override compile(node: Node): string {
    this.bindIndex = 0;
    return super.compile(node);
  }

  override compileWithCollector(node: Node): SQLString {
    this.bindIndex = 0;
    return super.compileWithCollector(node);
  }

  protected override visitBindParam(node: Nodes.BindParam): SQLString {
    if (node.value !== undefined) {
      this.collector.append(this.quote(node.value));
    } else {
      this.bindIndex += 1;
      this.collector.append(`$${this.bindIndex}`);
    }
    return this.collector;
  }
}
