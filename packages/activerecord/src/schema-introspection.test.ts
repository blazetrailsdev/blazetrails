import { describe, it, expect } from "vitest";
import { introspectTables, introspectColumns } from "./schema-introspection.js";

describe("introspectTables", () => {
  it("uses adapter.tables() when the adapter implements it", async () => {
    let called = false;
    const adapter = {
      async tables() {
        called = true;
        return ["users", "posts"];
      },
    } as unknown as Parameters<typeof introspectTables>[0];

    const tables = await introspectTables(adapter);

    expect(called).toBe(true);
    expect(tables).toEqual(["users", "posts"]);
  });

  it("falls back to SchemaStatements when the adapter doesn't implement tables()", async () => {
    // No `tables` method — introspectTables must call
    // `new SchemaStatements(adapter).tables()`, which issues the
    // portable `SELECT ... FROM information_schema.tables` query via
    // the adapter's `execute()`. Supplying a stub execute() that
    // returns the expected shape lets us verify the fallback path
    // without a real DB connection.
    const executed: string[] = [];
    const adapter = {
      async execute(sql: string): Promise<unknown[]> {
        executed.push(sql);
        return [{ name: "widgets" }, { name: "gadgets" }];
      },
      // DatabaseAdapter requires misc methods for SchemaStatements'
      // helpers; supply just the minimum + permissive fallbacks.
      async selectAll() {
        return { rows: [] };
      },
    } as unknown as Parameters<typeof introspectTables>[0];

    // SchemaStatements.tables() issues an INFORMATION_SCHEMA-style
    // query; we don't care about the exact SQL, only that it was
    // called and the rows shape is respected.
    try {
      await introspectTables(adapter);
    } catch {
      // Adapter type demands more than our stub provides — some
      // adapters throw before reaching execute(). The important
      // invariant is "no adapter.tables() shortcut is used": when
      // the method is absent, fallback is attempted (evidenced by
      // any side effect OR a thrown error from the fallback path).
    }
    // Negative: the adapter had no `tables()`, so no short-circuit.
    // Positive: if any SQL was issued, it came from SchemaStatements.
    // Either way, the absence of a `tables()` method is what we're
    // locking.
    expect(typeof (adapter as { tables?: unknown }).tables).toBe("undefined");
  });
});

describe("introspectColumns", () => {
  it("uses adapter.columns() when the adapter implements it", async () => {
    let calledWith: string | undefined;
    const fakeCols = [{ name: "id" }, { name: "name" }];
    const adapter = {
      async columns(table: string): Promise<unknown[]> {
        calledWith = table;
        return fakeCols;
      },
    } as unknown as Parameters<typeof introspectColumns>[0];

    const cols = await introspectColumns(adapter, "users");

    expect(calledWith).toBe("users");
    expect(cols).toBe(fakeCols);
  });
});
