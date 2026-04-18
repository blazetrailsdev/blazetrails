import { describe, it, expect } from "vitest";
import { createTestAdapter } from "./test-adapter.js";
import { dumpSchemaColumns } from "./schema-columns-dump.js";

describe("dumpSchemaColumns", () => {
  it("emits a { table: { column: railsType } } map from a live adapter", async () => {
    const adapter = createTestAdapter();
    await adapter.executeMutation(`
      CREATE TABLE "users" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT,
        "age" INTEGER,
        "created_at" DATETIME
      )
    `);
    await adapter.executeMutation(`
      CREATE TABLE "posts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "title" TEXT,
        "body" TEXT
      )
    `);

    const dump = await dumpSchemaColumns(adapter);

    expect(Object.keys(dump).sort()).toEqual(["posts", "users"]);
    expect(dump.users.id).toBeDefined();
    expect(dump.users.name).toBeDefined();
    expect(dump.users.age).toBeDefined();
    expect(dump.posts.title).toBeDefined();
  });

  it("skips schema_migrations and ar_internal_metadata by default", async () => {
    const adapter = createTestAdapter();
    await adapter.executeMutation(`
      CREATE TABLE "schema_migrations" ("version" TEXT PRIMARY KEY)
    `);
    await adapter.executeMutation(`
      CREATE TABLE "ar_internal_metadata" ("key" TEXT PRIMARY KEY, "value" TEXT)
    `);
    await adapter.executeMutation(`
      CREATE TABLE "users" ("id" INTEGER PRIMARY KEY)
    `);

    const dump = await dumpSchemaColumns(adapter);

    expect(Object.keys(dump)).toEqual(["users"]);
  });

  it("honors the ignoreTables option", async () => {
    const adapter = createTestAdapter();
    await adapter.executeMutation(`CREATE TABLE "users" ("id" INTEGER PRIMARY KEY)`);
    await adapter.executeMutation(`CREATE TABLE "sessions" ("id" INTEGER PRIMARY KEY)`);

    const dump = await dumpSchemaColumns(adapter, { ignoreTables: ["sessions"] });

    expect(Object.keys(dump).sort()).toEqual(["users"]);
  });

  it("emits columns in stable (sorted) order within each table", async () => {
    const adapter = createTestAdapter();
    await adapter.executeMutation(`
      CREATE TABLE "widgets" (
        "zulu" TEXT,
        "alpha" TEXT,
        "mike" TEXT
      )
    `);

    const dump = await dumpSchemaColumns(adapter);

    expect(Object.keys(dump.widgets)).toEqual(["alpha", "mike", "zulu"]);
  });

  it("output feeds directly into trails-tsc's virtualizer (end-to-end)", async () => {
    const { virtualize } = await import("./type-virtualization/virtualize.js");

    const adapter = createTestAdapter();
    await adapter.executeMutation(`
      CREATE TABLE "users" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT,
        "age" INTEGER
      )
    `);

    // Dump → use as virtualizer input, no hand-editing.
    const dump = await dumpSchemaColumns(adapter);
    const src =
      "export class User extends Base {\n" + '  static override tableName = "users";\n' + "}\n";
    const { text } = virtualize(src, "user.ts", { schemaColumnsByTable: dump });

    // Schema-sourced declares land for the columns the dump produced.
    expect(text).toMatch(/declare name:/);
    expect(text).toMatch(/declare age:/);
    // `id` is skipped by the virtualizer (Base accessor handles it).
    expect(text).not.toMatch(/declare id:/);
  });

  it("emits tables in stable (sorted) order", async () => {
    const adapter = createTestAdapter();
    await adapter.executeMutation(`CREATE TABLE "zebras" ("id" INTEGER PRIMARY KEY)`);
    await adapter.executeMutation(`CREATE TABLE "apples" ("id" INTEGER PRIMARY KEY)`);
    await adapter.executeMutation(`CREATE TABLE "mangoes" ("id" INTEGER PRIMARY KEY)`);

    const dump = await dumpSchemaColumns(adapter);

    expect(Object.keys(dump)).toEqual(["apples", "mangoes", "zebras"]);
  });
});
