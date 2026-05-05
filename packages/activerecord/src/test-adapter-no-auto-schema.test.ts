import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestAdapter, cleanupTestAdapter, resetTestAdapterState } from "./test-adapter.js";
import { defineSchema } from "./test-helpers/define-schema.js";
import type { DatabaseAdapter } from "./adapter.js";

// ---------------------------------------------------------------------------
// Control group: AR_NO_AUTO_SCHEMA unset — existing behavior unchanged
// ---------------------------------------------------------------------------

describe("AR_NO_AUTO_SCHEMA unset (control)", () => {
  let adapter: DatabaseAdapter;

  beforeEach(async () => {
    await resetTestAdapterState();
    adapter = createTestAdapter();
  });

  afterEach(async () => {
    await cleanupTestAdapter(adapter);
  });

  it("auto-creates a table when a model sets its adapter", async () => {
    const { Base } = await import("./base.js");
    class Widget extends Base {
      static {
        this.tableName = "widgets";
        this.attribute("name", "string");
        this.adapter = adapter;
      }
    }

    await adapter.executeMutation(`INSERT INTO "widgets" ("name") VALUES ('cog')`);
    const rows = await adapter.execute(`SELECT * FROM "widgets"`);
    expect(rows.length).toBeGreaterThan(0);
    void Widget;
  });
});

// ---------------------------------------------------------------------------
// AR_NO_AUTO_SCHEMA=1: dynamic adapter degrades to a thin pass-through
// ---------------------------------------------------------------------------

describe("AR_NO_AUTO_SCHEMA=1", () => {
  beforeEach(() => {
    vi.stubEnv("AR_NO_AUTO_SCHEMA", "1");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("Base.adapter = x does NOT register the model for auto table creation", async () => {
    const { createTestAdapter: freshFactory, resetTestAdapterState: freshReset } =
      await import("./test-adapter.js");
    await freshReset();
    const adapter = freshFactory();
    const { Base } = await import("./base.js");

    class Gadget extends Base {
      static {
        this.tableName = "gadgets";
        this.attribute("label", "string");
        this.adapter = adapter;
      }
    }
    void Gadget;

    // The hook was not registered, so no pending models were queued.
    // A query against the missing table should fail with a DB error, not succeed.
    await expect(adapter.execute(`SELECT * FROM "gadgets"`)).rejects.toThrow();
  });

  it("INSERT into a missing table throws the underlying DB error", async () => {
    const { createTestAdapter: freshFactory, resetTestAdapterState: freshReset } =
      await import("./test-adapter.js");
    await freshReset();
    const adapter = freshFactory();

    await expect(
      adapter.executeMutation(`INSERT INTO "no_such_table" ("x") VALUES ('y')`),
    ).rejects.toThrow();
  });

  it("passes when the caller pre-creates the table via defineSchema()", async () => {
    const { createTestAdapter: freshFactory, resetTestAdapterState: freshReset } =
      await import("./test-adapter.js");
    await freshReset();
    const adapter = freshFactory();

    await defineSchema(adapter, {
      gadgets: { label: "string" },
    });

    await adapter.executeMutation(`INSERT INTO "gadgets" ("label") VALUES ('wrench')`);
    const rows = await adapter.execute(`SELECT * FROM "gadgets"`);
    expect(rows).toHaveLength(1);
  });
});
