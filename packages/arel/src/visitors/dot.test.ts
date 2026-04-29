import { describe, it, expect } from "vitest";
import {
  Table,
  star,
  SelectManager,
  InsertManager,
  UpdateManager,
  DeleteManager,
  Nodes,
  Visitors,
} from "../index.js";

describe("TestDot", () => {
  const users = new Table("users");
  const dot = new Visitors.Dot();

  it("named function", () => {
    const node = new Nodes.NamedFunction("COUNT", [users.get("id")]);
    const out = dot.compile(node);
    expect(out).toContain("NamedFunction");
  });

  it("Arel Nodes BindParam", () => {
    const node = new Nodes.BindParam();
    const out = dot.compile(node);
    expect(out).toContain("BindParam");
  });

  it("ActiveModel Attribute", () => {
    const node = users.get("id");
    const out = dot.compile(node);
    expect(out).toContain("Attribute");
  });

  it("Arel Nodes CurrentRow", () => {
    const node = new Nodes.CurrentRow();
    const out = dot.compile(node);
    expect(out).toContain("CurrentRow");
  });

  it("Arel Nodes Distinct", () => {
    const node = new Nodes.Distinct();
    const out = dot.compile(node);
    expect(out).toContain("Distinct");
  });

  it("Arel Nodes Case and friends", () => {
    const node = new Nodes.Case(users.get("status")).when("active", "A").else("Z");
    const out = dot.compile(node);
    expect(out).toContain("Case");
  });

  it("Arel Nodes InfixOperation", () => {
    const node = new Nodes.InfixOperation("+", users.get("age"), new Nodes.Quoted(1));
    const out = dot.compile(node);
    expect(out).toContain("InfixOperation");
  });

  it("Arel Nodes RegExp", () => {
    const node = new Nodes.Regexp(users.get("name"), new Nodes.Quoted("a.*"));
    const out = dot.compile(node);
    expect(out).toContain("Regexp");
  });

  it("Arel Nodes NotRegExp", () => {
    const node = new Nodes.NotRegexp(users.get("name"), new Nodes.Quoted("a.*"));
    const out = dot.compile(node);
    expect(out).toContain("NotRegexp");
  });

  it("Arel Nodes UnaryOperation", () => {
    const node = new Nodes.UnaryOperation("NOT ", users.get("active"));
    const out = dot.compile(node);
    expect(out).toContain("UnaryOperation");
  });

  it("Arel Nodes With", () => {
    const cte = new Nodes.Cte("t", users.project(users.get("id")).ast);
    const stmt = new SelectManager().with(cte).project("1").ast;
    const out = dot.compile(stmt);
    expect(out).toContain("With");
    expect(out).toContain("Cte");
  });

  it("Arel Nodes SelectCore", () => {
    const stmt = users.project(star).ast;
    const out = dot.compile(stmt.cores[0]);
    expect(out).toContain("SelectCore");
  });

  it("Arel Nodes SelectStatement", () => {
    const stmt = users.project(star).ast;
    const out = dot.compile(stmt);
    expect(out).toContain("SelectStatement");
  });

  it("Arel Nodes InsertStatement", () => {
    const stmt = new InsertManager(users).insert([[users.get("name"), "dean"]]).ast;
    const out = dot.compile(stmt);
    expect(out).toContain("InsertStatement");
  });

  it("Arel Nodes UpdateStatement", () => {
    const stmt = new UpdateManager().table(users).set([[users.get("name"), "sam"]]).ast;
    const out = dot.compile(stmt);
    expect(out).toContain("UpdateStatement");
  });

  it("Arel Nodes DeleteStatement", () => {
    const stmt = new DeleteManager().from(users).ast;
    const out = dot.compile(stmt);
    expect(out).toContain("DeleteStatement");
  });

  describe("output structure (Rails parity)", () => {
    it("emits the Rails dot.rb header and shape", () => {
      const out = dot.compile(new Nodes.Distinct());
      expect(out).toMatch(/^digraph "Arel" \{\n/);
      expect(out).toContain("node [width=0.375,height=0.25,shape=record];");
      expect(out).toMatch(/\n\}$/);
      // A leaf node: id [label="<f0>Name"];
      expect(out).toMatch(/^\d+ \[label="<f0>Distinct"\];$/m);
    });

    it("emits one edge per visit_edge declaration with the field name as label", () => {
      // Binary -> left, right (two visit_edge calls).
      const node = new Nodes.Equality(users.get("id"), new Nodes.SqlLiteral("1"));
      const out = dot.compile(node);
      expect(out).toMatch(/-> \d+ \[label="left"\];/);
      expect(out).toMatch(/-> \d+ \[label="right"\];/);
    });

    it("emits an InfixOperation's three edges in Rails order: operator, left, right", () => {
      const node = new Nodes.InfixOperation("+", users.get("age"), new Nodes.Quoted(1));
      const out = dot.compile(node);
      const operatorPos = out.indexOf('[label="operator"]');
      const leftPos = out.indexOf('[label="left"]');
      const rightPos = out.indexOf('[label="right"]');
      expect(operatorPos).toBeGreaterThan(-1);
      expect(operatorPos).toBeLessThan(leftPos);
      expect(leftPos).toBeLessThan(rightPos);
    });

    it("collapses to a leaf for visit_NoEdges nodes (CurrentRow, Distinct)", () => {
      const out = dot.compile(new Nodes.CurrentRow());
      // Single node, no edges.
      const edges = (out.match(/->/g) ?? []).length;
      expect(edges).toBe(0);
    });

    it("escapes embedded double-quotes in side-field labels (quote helper)", () => {
      const node = new Nodes.SqlLiteral('say "hi"');
      const out = dot.compile(node);
      // SqlLiteral is dispatched as visit_String — the value becomes a
      // side-field on the parent node with quote() escaping the `"`.
      expect(out).toContain('say \\"hi\\"');
    });

    it("visitHash preserves both key and value (Rails parity)", () => {
      // Mirrors Rails dot.rb:227 — visit_Hash emits one edge per entry
      // labeled "pair_<i>" pointing at an Array node, which itself emits
      // index-labeled edges for the [key, value] tuple. Both halves of
      // the entry must end up in the graph.
      const v = new Visitors.Dot();
      type Internals = { visit(o: unknown): void };
      v.compile(new Nodes.SqlLiteral("")); // initialize state
      (v as unknown as Internals).visit({ alpha: "A", beta: "B" });
      const out = (v as unknown as { toDot(): string }).toDot();
      expect(out).toContain('[label="pair_0"]');
      expect(out).toContain('[label="pair_1"]');
      expect(out).toContain("alpha");
      expect(out).toContain("beta");
      expect(out).toContain("A");
      expect(out).toContain("B");
    });
  });
});
