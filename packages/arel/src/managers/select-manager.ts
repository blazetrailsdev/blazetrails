import { Node } from "../nodes/node.js";
import { SelectStatement } from "../nodes/select-statement.js";
import { SelectCore } from "../nodes/select-core.js";
import { SqlLiteral } from "../nodes/sql-literal.js";
import { Attribute } from "../nodes/attribute.js";
import { Distinct } from "../nodes/distinct.js";
import { Offset, Limit, Lock, On } from "../nodes/unary.js";
import {
  InnerJoin,
  OuterJoin,
  RightOuterJoin,
  FullOuterJoin,
  CrossJoin,
  StringJoin,
} from "../nodes/join.js";
import { Quoted } from "../nodes/quoted.js";
import { Union, UnionAll, Intersect, Except } from "../nodes/set-operations.js";
import { With, WithRecursive } from "../nodes/with.js";
import { Exists } from "../nodes/exists.js";
import { Over } from "../nodes/window.js";
import { Table } from "../table.js";
import { ToSql } from "../visitors/to-sql.js";

/**
 * SelectManager — the chainable API for building SELECT queries.
 *
 * Mirrors: Arel::SelectManager
 */
export class SelectManager {
  readonly ast: SelectStatement;

  constructor(table?: Table | null) {
    this.ast = new SelectStatement();
    if (table) {
      this.from(table);
    }
  }

  private get core(): SelectCore {
    return this.ast.cores[this.ast.cores.length - 1];
  }

  /**
   * Set the FROM table.
   */
  from(table: Table | Node | string): this {
    if (typeof table === "string") {
      this.core.source.left = new SqlLiteral(table);
    } else {
      this.core.source.left = table;
    }
    return this;
  }

  /**
   * Add projections (columns to SELECT).
   */
  project(...projections: (Node | string)[]): this {
    for (const p of projections) {
      if (typeof p === "string") {
        this.core.projections.push(new SqlLiteral(p));
      } else {
        this.core.projections.push(p);
      }
    }
    return this;
  }

  /**
   * Add a WHERE condition.
   */
  where(condition: Node): this {
    this.core.wheres.push(condition);
    return this;
  }

  /**
   * Add ORDER BY clauses.
   */
  order(...exprs: Node[]): this {
    this.ast.orders.push(...exprs);
    return this;
  }

  /**
   * Set LIMIT.
   */
  take(amount: number | Node): this {
    if (amount instanceof Node) {
      this.ast.limit = amount;
    } else {
      this.ast.limit = new Limit(new Quoted(amount));
    }
    return this;
  }

  /**
   * Set OFFSET.
   */
  skip(amount: number | Node): this {
    if (amount instanceof Node) {
      this.ast.offset = amount;
    } else {
      this.ast.offset = new Offset(new Quoted(amount));
    }
    return this;
  }

  /**
   * Add GROUP BY.
   */
  group(...exprs: (Node | string)[]): this {
    for (const e of exprs) {
      if (typeof e === "string") {
        this.core.groups.push(new SqlLiteral(e));
      } else {
        this.core.groups.push(e);
      }
    }
    return this;
  }

  /**
   * Add HAVING.
   */
  having(condition: Node): this {
    this.core.havings.push(condition);
    return this;
  }

  /**
   * INNER JOIN.
   */
  join(table: Node | string, onCondition?: Node): this {
    const tableNode = typeof table === "string" ? new SqlLiteral(table) : table;
    const onNode = onCondition ? new On(onCondition) : null;
    this.core.source.right.push(new InnerJoin(tableNode, onNode));
    return this;
  }

  /**
   * LEFT OUTER JOIN.
   */
  outerJoin(table: Node | string, onCondition?: Node): this {
    const tableNode = typeof table === "string" ? new SqlLiteral(table) : table;
    const onNode = onCondition ? new On(onCondition) : null;
    this.core.source.right.push(new OuterJoin(tableNode, onNode));
    return this;
  }

  /**
   * Make the SELECT DISTINCT.
   */
  distinct(): this {
    this.core.setQuantifier = new Distinct();
    return this;
  }

  /**
   * Add a lock clause (FOR UPDATE by default).
   */
  lock(lockClause?: string): this {
    this.ast.lock = new Lock(lockClause ?? null);
    return this;
  }

  /**
   * Set WITH (CTE).
   */
  with(...ctes: Node[]): this {
    this.ast.with = new With(ctes);
    return this;
  }

  /**
   * Set WITH RECURSIVE.
   */
  withRecursive(...ctes: Node[]): this {
    this.ast.with = new WithRecursive(ctes);
    return this;
  }

  /**
   * UNION with another manager.
   */
  union(other: SelectManager | SelectStatement): Node {
    const otherAst = other instanceof SelectManager ? other.ast : other;
    return new Union(this.ast, otherAst);
  }

  /**
   * UNION ALL with another manager.
   */
  unionAll(other: SelectManager | SelectStatement): Node {
    const otherAst = other instanceof SelectManager ? other.ast : other;
    return new UnionAll(this.ast, otherAst);
  }

  /**
   * INTERSECT with another manager.
   */
  intersect(other: SelectManager | SelectStatement): Node {
    const otherAst = other instanceof SelectManager ? other.ast : other;
    return new Intersect(this.ast, otherAst);
  }

  /**
   * EXCEPT with another manager.
   */
  except(other: SelectManager | SelectStatement): Node {
    const otherAst = other instanceof SelectManager ? other.ast : other;
    return new Except(this.ast, otherAst);
  }

  /**
   * Wrap as EXISTS(subquery).
   */
  exists(): Exists {
    return new Exists(this.ast);
  }

  /**
   * Generate SQL string.
   */
  toSql(): string {
    return new ToSql().compile(this.ast);
  }
}
