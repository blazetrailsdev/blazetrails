import { Node, NodeVisitor } from "./node.js";
import type { Table } from "../table.js";
import {
  Equality,
  NotEqual,
  GreaterThan,
  GreaterThanOrEqual,
  LessThan,
  LessThanOrEqual,
  Matches,
  DoesNotMatch,
  In,
  NotIn,
  Between,
  Addition,
  Subtraction,
  Multiplication,
  Division,
  As,
} from "./binary.js";
import { Ascending, Descending } from "./unary.js";
import { Quoted } from "./quoted.js";
import { Grouping } from "./grouping.js";
import { And } from "./and.js";
import { Or } from "./or.js";
import { SqlLiteral } from "./sql-literal.js";
import { NamedFunction } from "./named-function.js";

function buildQuoted(value: unknown): Node {
  if (value instanceof Node) return value;
  return new Quoted(value);
}

/**
 * Combines multiple nodes with OR, wrapped in a Grouping.
 */
function groupedAny(nodes: Node[]): Grouping {
  const combined = nodes.reduce((left, right) => new Or(left, right));
  return new Grouping(combined);
}

/**
 * Combines multiple nodes with AND, wrapped in a Grouping.
 */
function groupedAll(nodes: Node[]): Grouping {
  return new Grouping(new And(nodes));
}

/**
 * Attribute — represents a column on a table.
 *
 * Mirrors: Arel::Attributes::Attribute
 */
export class Attribute extends Node {
  readonly relation: Table;
  readonly name: string;

  constructor(relation: Table, name: string) {
    super();
    this.relation = relation;
    this.name = name;
  }

  // -- Predicates --

  eq(other: unknown): Equality {
    return new Equality(this, buildQuoted(other));
  }

  notEq(other: unknown): NotEqual {
    return new NotEqual(this, buildQuoted(other));
  }

  gt(other: unknown): GreaterThan {
    return new GreaterThan(this, buildQuoted(other));
  }

  gteq(other: unknown): GreaterThanOrEqual {
    return new GreaterThanOrEqual(this, buildQuoted(other));
  }

  lt(other: unknown): LessThan {
    return new LessThan(this, buildQuoted(other));
  }

  lteq(other: unknown): LessThanOrEqual {
    return new LessThanOrEqual(this, buildQuoted(other));
  }

  matches(pattern: string, _caseSensitive = true): Matches {
    return new Matches(this, buildQuoted(pattern));
  }

  doesNotMatch(pattern: string, _caseSensitive = true): DoesNotMatch {
    return new DoesNotMatch(this, buildQuoted(pattern));
  }

  in(values: unknown[]): In {
    return new In(this, values.map(buildQuoted));
  }

  notIn(values: unknown[]): NotIn {
    return new NotIn(this, values.map(buildQuoted));
  }

  between(begin: unknown, end: unknown): Between {
    return new Between(this, new And([buildQuoted(begin), buildQuoted(end)]));
  }

  isNull(): Equality {
    return new Equality(this, new Quoted(null));
  }

  isNotNull(): NotEqual {
    return new NotEqual(this, new Quoted(null));
  }

  // -- _any / _all variants --

  eqAny(others: unknown[]): Grouping {
    return groupedAny(others.map((o) => this.eq(o)));
  }

  eqAll(others: unknown[]): Grouping {
    return groupedAll(others.map((o) => this.eq(o)));
  }

  notEqAny(others: unknown[]): Grouping {
    return groupedAny(others.map((o) => this.notEq(o)));
  }

  notEqAll(others: unknown[]): Grouping {
    return groupedAll(others.map((o) => this.notEq(o)));
  }

  gtAny(others: unknown[]): Grouping {
    return groupedAny(others.map((o) => this.gt(o)));
  }

  gtAll(others: unknown[]): Grouping {
    return groupedAll(others.map((o) => this.gt(o)));
  }

  gteqAny(others: unknown[]): Grouping {
    return groupedAny(others.map((o) => this.gteq(o)));
  }

  gteqAll(others: unknown[]): Grouping {
    return groupedAll(others.map((o) => this.gteq(o)));
  }

  ltAny(others: unknown[]): Grouping {
    return groupedAny(others.map((o) => this.lt(o)));
  }

  ltAll(others: unknown[]): Grouping {
    return groupedAll(others.map((o) => this.lt(o)));
  }

  lteqAny(others: unknown[]): Grouping {
    return groupedAny(others.map((o) => this.lteq(o)));
  }

  lteqAll(others: unknown[]): Grouping {
    return groupedAll(others.map((o) => this.lteq(o)));
  }

  matchesAny(others: string[]): Grouping {
    return groupedAny(others.map((o) => this.matches(o)));
  }

  matchesAll(others: string[]): Grouping {
    return groupedAll(others.map((o) => this.matches(o)));
  }

  doesNotMatchAny(others: string[]): Grouping {
    return groupedAny(others.map((o) => this.doesNotMatch(o)));
  }

  doesNotMatchAll(others: string[]): Grouping {
    return groupedAll(others.map((o) => this.doesNotMatch(o)));
  }

  inAny(others: unknown[][]): Grouping {
    return groupedAny(others.map((o) => this.in(o)));
  }

  inAll(others: unknown[][]): Grouping {
    return groupedAll(others.map((o) => this.in(o)));
  }

  notInAny(others: unknown[][]): Grouping {
    return groupedAny(others.map((o) => this.notIn(o)));
  }

  notInAll(others: unknown[][]): Grouping {
    return groupedAll(others.map((o) => this.notIn(o)));
  }

  // -- Ordering --

  asc(): Ascending {
    return new Ascending(this);
  }

  desc(): Descending {
    return new Descending(this);
  }

  // -- Math --

  add(other: unknown): Addition {
    return new Addition(this, buildQuoted(other));
  }

  subtract(other: unknown): Subtraction {
    return new Subtraction(this, buildQuoted(other));
  }

  multiply(other: unknown): Multiplication {
    return new Multiplication(this, buildQuoted(other));
  }

  divide(other: unknown): Division {
    return new Division(this, buildQuoted(other));
  }

  // -- Aliasing --

  as(aliasName: string): As {
    return new As(this, new SqlLiteral(aliasName));
  }

  // -- Aggregate functions --

  count(distinct = false): NamedFunction {
    return new NamedFunction("COUNT", [this], undefined, distinct);
  }

  sum(): NamedFunction {
    return new NamedFunction("SUM", [this]);
  }

  maximum(): NamedFunction {
    return new NamedFunction("MAX", [this]);
  }

  minimum(): NamedFunction {
    return new NamedFunction("MIN", [this]);
  }

  average(): NamedFunction {
    return new NamedFunction("AVG", [this]);
  }

  // -- String functions --

  lower(): NamedFunction {
    return new NamedFunction("LOWER", [this]);
  }

  upper(): NamedFunction {
    return new NamedFunction("UPPER", [this]);
  }

  // -- Null handling --

  coalesce(...others: unknown[]): NamedFunction {
    return new NamedFunction("COALESCE", [this, ...others.map(buildQuoted)]);
  }

  accept<T>(visitor: NodeVisitor<T>): T {
    return visitor.visit(this);
  }
}
