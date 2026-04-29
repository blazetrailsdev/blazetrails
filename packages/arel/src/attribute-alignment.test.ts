import { describe, it, expect } from "vitest";
import { Table, Nodes, Visitors } from "./index.js";

const users = new Table("users");
const compile = (n: Nodes.Node): string => new Visitors.ToSql().compile(n);

// Behavior tests for the attribute-alignment changes — typed-subclass
// returns from aggregates / contains / overlaps / concat, plus the
// `retryable: true` flag on alias SqlLiterals across every per-class
// `as()` override.

describe("Attribute aggregates return typed Function subclasses", () => {
  it("count compiles to COUNT(...) and is a Count", () => {
    const c = users.get("id").count();
    expect(c).toBeInstanceOf(Nodes.Count);
    expect(compile(c)).toBe('COUNT("users"."id")');
  });

  it("count(true) emits COUNT(DISTINCT ...)", () => {
    expect(compile(users.get("id").count(true))).toBe('COUNT(DISTINCT "users"."id")');
  });

  it("sum/maximum/minimum/average return typed subclasses", () => {
    expect(users.get("id").sum()).toBeInstanceOf(Nodes.Sum);
    expect(users.get("id").maximum()).toBeInstanceOf(Nodes.Max);
    expect(users.get("id").minimum()).toBeInstanceOf(Nodes.Min);
    expect(users.get("id").average()).toBeInstanceOf(Nodes.Avg);
  });
});

describe("Attribute concat / contains / overlaps return typed infix subclasses", () => {
  it("concat builds a Concat (SQL ||), not a CONCAT(...) function", () => {
    const c = users.attr("first").concat(users.attr("last"));
    expect(c).toBeInstanceOf(Nodes.Concat);
    const sql = compile(c);
    expect(sql).toBe('"users"."first" || "users"."last"');
    // Regression: must NOT emit the old NamedFunction CONCAT(...) form.
    expect(sql).not.toContain("CONCAT(");
  });

  it("contains is a Contains (PostgreSQL @>)", () => {
    const arr = new Nodes.SqlLiteral("ARRAY[1,2]");
    const c = users.attr("ids").contains(arr);
    expect(c).toBeInstanceOf(Nodes.Contains);
    expect(compile(c)).toContain("@>");
  });

  it("overlaps is an Overlaps (PostgreSQL &&)", () => {
    const arr = new Nodes.SqlLiteral("ARRAY[1,2]");
    const o = users.attr("ids").overlaps(arr);
    expect(o).toBeInstanceOf(Nodes.Overlaps);
    expect(compile(o)).toContain("&&");
  });
});

describe("Per-class `as(name)` marks the alias SqlLiteral as retryable", () => {
  // Mirrors Arel::AliasPredication#as in Rails:
  //   Nodes::SqlLiteral.new(other, retryable: true)
  // The retryable flag tells the collector that the bare alias name
  // doesn't break parameterized-SQL retry-by-bind-cache. Without it,
  // visiting an `As(left, SqlLiteral("alias"))` would flip
  // collector.retryable to false.

  const collectorIsRetryableAfter = (n: Nodes.Node): boolean =>
    new Visitors.ToSql().compileWithCollector(n).retryable;

  it("Attribute#as keeps the collector retryable", () => {
    expect(collectorIsRetryableAfter(users.attr("id").as("aliased"))).toBe(true);
  });

  it("Binary subclass `as` (via Equality#as) keeps the collector retryable", () => {
    const eq = new Nodes.Equality(users.attr("id"), new Nodes.SqlLiteral("1", { retryable: true }));
    expect(collectorIsRetryableAfter(eq.as("aliased"))).toBe(true);
  });

  it("Grouping#as keeps the collector retryable", () => {
    const g = new Nodes.Grouping(new Nodes.SqlLiteral("x", { retryable: true }));
    expect(collectorIsRetryableAfter(g.as("aliased"))).toBe(true);
  });
});
