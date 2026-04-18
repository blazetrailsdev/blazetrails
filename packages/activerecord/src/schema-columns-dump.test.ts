import { describe, it, expect } from "vitest";
import { createTestAdapter } from "./test-adapter.js";
import { MigrationContext } from "./migration.js";
import { dumpSchemaColumns } from "./schema-columns-dump.js";
import { SchemaMigration } from "./schema-migration.js";

function fresh(): {
  adapter: ReturnType<typeof createTestAdapter>;
  ctx: MigrationContext;
} {
  const adapter = createTestAdapter();
  const ctx = new MigrationContext(adapter);
  return { adapter, ctx };
}

describe("dumpSchemaColumns", () => {
  it("emits a { table: { column: railsType } } map from a live adapter", async () => {
    const { adapter, ctx } = fresh();
    await ctx.createTable("users", {}, (t) => {
      t.string("name");
      t.integer("age");
      t.datetime("created_at");
    });
    await ctx.createTable("posts", {}, (t) => {
      t.string("title");
      t.text("body");
    });

    const dump = await dumpSchemaColumns(adapter);

    expect(Object.keys(dump).sort()).toEqual(["posts", "users"]);
    expect(dump.users.id).toBeDefined();
    expect(dump.users.name).toBeDefined();
    expect(dump.users.age).toBeDefined();
    expect(dump.posts.title).toBeDefined();
  });

  it("skips schema_migrations and ar_internal_metadata by default", async () => {
    const { adapter, ctx } = fresh();
    // SchemaMigration.createTable() uses the adapter's portable DDL.
    const sm = new SchemaMigration(adapter);
    await sm.createTable();
    await ctx.createTable("users", {}, () => {});

    const dump = await dumpSchemaColumns(adapter);

    expect(Object.keys(dump)).toContain("users");
    expect(Object.keys(dump)).not.toContain("schema_migrations");
  });

  it("honors the ignoreTables option", async () => {
    const { adapter, ctx } = fresh();
    await ctx.createTable("users", {}, () => {});
    await ctx.createTable("sessions", {}, () => {});

    const dump = await dumpSchemaColumns(adapter, { ignoreTables: ["sessions"] });

    expect(Object.keys(dump).sort()).toEqual(["users"]);
  });

  it("emits columns in stable (sorted) order within each table", async () => {
    const { adapter, ctx } = fresh();
    await ctx.createTable("widgets", {}, (t) => {
      t.string("zulu");
      t.string("alpha");
      t.string("mike");
    });

    const dump = await dumpSchemaColumns(adapter);

    expect(Object.keys(dump.widgets)).toEqual(["alpha", "id", "mike", "zulu"]);
  });

  it("emits tables in stable (sorted) order", async () => {
    const { adapter, ctx } = fresh();
    await ctx.createTable("zebras", {}, () => {});
    await ctx.createTable("apples", {}, () => {});
    await ctx.createTable("mangoes", {}, () => {});

    const dump = await dumpSchemaColumns(adapter);

    expect(Object.keys(dump)).toEqual(["apples", "mangoes", "zebras"]);
  });

  it("output feeds directly into trails-tsc's virtualizer (end-to-end)", async () => {
    const { virtualize } = await import("./type-virtualization/virtualize.js");

    const { adapter, ctx } = fresh();
    await ctx.createTable("users", {}, (t) => {
      t.string("name");
      t.integer("age");
    });

    // Dump → use as virtualizer input, no hand-editing.
    const dump = await dumpSchemaColumns(adapter);
    const src =
      "export class User extends Base {\n" + '  static override tableName = "users";\n' + "}\n";
    const { text } = virtualize(src, "user.ts", { schemaColumnsByTable: dump });

    expect(text).toMatch(/declare name:/);
    expect(text).toMatch(/declare age:/);
    // `id` is skipped by the virtualizer (Base accessor handles it).
    expect(text).not.toMatch(/declare id:/);
  });
});
