import { afterEach, describe, expect, it } from "vitest";
import { Nodes, Table, Visitors } from "@blazetrails/arel";
import {
  clearAdapterVisitor,
  installAdapterVisitor,
  restoreEstablishedVisitor,
  visitorClassForAdapter,
} from "./arel-visitor-sync.js";
import { SQLite3Adapter } from "./connection-adapters/sqlite3-adapter.js";

// A node whose compiled SQL is produced by the global visitor (Node#toSql
// routes through the registry). Comparing its output to a direct dialect
// compile proves which visitor the global fallback currently points at,
// without needing a getter for the registry.
function sampleAst(): Nodes.Node {
  const t = new Table("users");
  return t.project(new Nodes.SqlLiteral("1")).take(5).ast as unknown as Nodes.Node;
}

afterEach(() => {
  clearAdapterVisitor();
});

describe("visitorClassForAdapter", () => {
  it("maps adapter aliases to the dialect visitor each adapter installs", () => {
    expect(visitorClassForAdapter("sqlite3")).toBe(Visitors.SQLite);
    expect(visitorClassForAdapter("sqlite")).toBe(Visitors.SQLite);
    expect(visitorClassForAdapter("postgresql")).toBe(Visitors.PostgreSQLWithBinds);
    expect(visitorClassForAdapter("postgres")).toBe(Visitors.PostgreSQLWithBinds);
    expect(visitorClassForAdapter("mysql")).toBe(Visitors.MySQL);
    expect(visitorClassForAdapter("mysql2")).toBe(Visitors.MySQL);
  });

  it("returns undefined for unknown adapters", () => {
    expect(visitorClassForAdapter("oracle")).toBeUndefined();
  });

  // Drift guard: the SQLite map entry must match the class the real adapter
  // installs in its arelVisitor(). Catches the map falling out of sync with
  // sqlite3-adapter.ts. (PG/MySQL adapters need a live driver to construct,
  // so their drift is covered by the alias-map assertions above against the
  // same arel classes their arelVisitor() returns.)
  it("matches SQLite3Adapter#arelVisitor", () => {
    const adapter = new SQLite3Adapter(":memory:");
    const installed = (adapter as unknown as { visitor: object }).visitor;
    expect(installed.constructor).toBe(visitorClassForAdapter("sqlite3"));
  });
});

describe("installAdapterVisitor", () => {
  it("points the global toSql visitor at the adapter's dialect", () => {
    const ast = sampleAst();

    installAdapterVisitor("mysql");
    expect(ast.toSql()).toBe(new Visitors.MySQL().compile(ast));

    installAdapterVisitor("postgresql");
    expect(ast.toSql()).toBe(new Visitors.PostgreSQLWithBinds().compile(ast));

    installAdapterVisitor("sqlite3");
    expect(ast.toSql()).toBe(new Visitors.SQLite().compile(ast));
  });

  it("falls back to the default ToSql visitor for unknown adapters", () => {
    const ast = sampleAst();
    installAdapterVisitor("oracle");
    expect(ast.toSql()).toBe(new Visitors.ToSql().compile(ast));
  });
});

describe("restoreEstablishedVisitor", () => {
  it("restores the last established dialect", () => {
    const ast = sampleAst();
    installAdapterVisitor("mysql");

    // Simulate test-setup.ts's afterEach resetting then restoring.
    restoreEstablishedVisitor();
    expect(ast.toSql()).toBe(new Visitors.MySQL().compile(ast));
  });

  it("restores the default when nothing is established", () => {
    const ast = sampleAst();
    clearAdapterVisitor();
    restoreEstablishedVisitor();
    expect(ast.toSql()).toBe(new Visitors.ToSql().compile(ast));
  });
});

describe("clearAdapterVisitor", () => {
  it("resets the global visitor to the default", () => {
    const ast = sampleAst();
    installAdapterVisitor("mysql");
    clearAdapterVisitor();
    expect(ast.toSql()).toBe(new Visitors.ToSql().compile(ast));
  });
});
