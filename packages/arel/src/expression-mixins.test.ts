import { describe, it, expect } from "vitest";
import { Nodes } from "./index.js";

// Behavior tests for the mixin surface added in this PR — Expressions,
// AliasPredication, OrderPredications, FilterPredications,
// WindowPredications, and the trailing Predications methods (when, concat,
// contains, overlaps, quotedArray). Verifies the methods are reachable on
// the right hosts AND build the AST shape Rails would.
//
// Receivers are SqlLiteral / Function / InfixOperation rather than
// Attribute, because Attribute pre-dates this PR and ships hand-rolled
// versions of count/sum/concat/contains/overlaps that return different
// node types (NamedFunction, generic InfixOperation). Aligning Attribute
// with Rails' Predications semantics is a separate refactor.

describe("Expressions mixin (on SqlLiteral)", () => {
  const lit = new Nodes.SqlLiteral("col");

  it("count/sum/maximum/minimum/average build the typed aggregate subclasses", () => {
    expect(lit.count()).toBeInstanceOf(Nodes.Count);
    expect(lit.sum()).toBeInstanceOf(Nodes.Sum);
    expect(lit.maximum()).toBeInstanceOf(Nodes.Max);
    expect(lit.minimum()).toBeInstanceOf(Nodes.Min);
    expect(lit.average()).toBeInstanceOf(Nodes.Avg);
  });

  it("count(true) sets the distinct flag on the Count node", () => {
    expect((lit.count(true) as { distinct: boolean }).distinct).toBe(true);
    expect((lit.count() as { distinct: boolean }).distinct).toBe(false);
  });

  it("extract builds an Extract node carrying the field", () => {
    const e = lit.extract("year");
    expect(e).toBeInstanceOf(Nodes.Extract);
    expect((e as { field: string }).field).toBe("year");
  });
});

describe("AliasPredication mixin", () => {
  it("on SqlLiteral wraps the receiver in an As node", () => {
    const aliased = new Nodes.SqlLiteral("MAX(x)").as("m");
    expect(aliased).toBeInstanceOf(Nodes.As);
  });

  it("on Function sets the alias and returns self (Rails Function#as)", () => {
    const sum = new Nodes.SqlLiteral("col").sum();
    const aliased = sum.as("total");
    expect(aliased).toBe(sum);
    expect((sum as { alias: { value: string } | null }).alias?.value).toBe("total");
  });
});

describe("OrderPredications mixin (on SqlLiteral)", () => {
  it("asc/desc wrap in Ascending / Descending", () => {
    const lit = new Nodes.SqlLiteral("col");
    expect(lit.asc()).toBeInstanceOf(Nodes.Ascending);
    expect(lit.desc()).toBeInstanceOf(Nodes.Descending);
  });
});

describe("WindowPredications.over (mixed into Function)", () => {
  const sum = new Nodes.SqlLiteral("col").sum();

  it("with no argument builds an Over node with null right", () => {
    const o = sum.over();
    expect(o).toBeInstanceOf(Nodes.Over);
    expect((o as { right: unknown }).right).toBe(null);
  });

  it("accepts a window-name string and a Node expr", () => {
    expect(sum.over("w")).toBeInstanceOf(Nodes.Over);
    expect(sum.over(new Nodes.SqlLiteral("PARTITION BY x"))).toBeInstanceOf(Nodes.Over);
  });
});

describe("FilterPredications.filter (mixed into Function)", () => {
  it("wraps in a Filter node carrying the predicate", () => {
    const sum = new Nodes.SqlLiteral("col").sum();
    const f = sum.filter(new Nodes.SqlLiteral("active"));
    expect(f).toBeInstanceOf(Nodes.Filter);
  });
});

describe("Predications trailing methods on SqlLiteral", () => {
  const lit = new Nodes.SqlLiteral("col");

  it("when opens a Case", () => {
    expect(lit.when("active")).toBeInstanceOf(Nodes.Case);
  });

  it("concat builds a Concat infix node (Rails: ||)", () => {
    const c = lit.concat(new Nodes.SqlLiteral("other"));
    expect(c).toBeInstanceOf(Nodes.Concat);
  });

  it("contains / overlaps build the @> / && infix nodes", () => {
    const arr = new Nodes.SqlLiteral("ARRAY[1,2]");
    expect(lit.contains(arr)).toBeInstanceOf(Nodes.Contains);
    expect(lit.overlaps(arr)).toBeInstanceOf(Nodes.Overlaps);
  });

  it("quotedArray maps each element through quotedNode", () => {
    const out = lit.quotedArray([1, "x"]);
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(2);
    expect(out[0]).toBeInstanceOf(Nodes.Node);
  });
});
