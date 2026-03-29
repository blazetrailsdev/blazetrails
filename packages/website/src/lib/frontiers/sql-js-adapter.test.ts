import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";

let adapter: SqlJsAdapter;

beforeEach(async () => {
  // Use the asm.js build (no WASM needed in Node tests)
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  adapter = new SqlJsAdapter(db);
});

describe("SqlJsAdapter", () => {
  describe("execute", () => {
    it("returns rows as objects", async () => {
      adapter.execRaw('CREATE TABLE "t" ("id" INTEGER PRIMARY KEY, "name" TEXT)');
      adapter.execRaw(`INSERT INTO "t" ("name") VALUES ('alice')`);
      adapter.execRaw(`INSERT INTO "t" ("name") VALUES ('bob')`);

      const rows = await adapter.execute('SELECT * FROM "t" ORDER BY "id"');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ id: 1, name: "alice" });
      expect(rows[1]).toEqual({ id: 2, name: "bob" });
    });

    it("supports bind parameters", async () => {
      adapter.execRaw('CREATE TABLE "t" ("name" TEXT)');
      adapter.execRaw(`INSERT INTO "t" ("name") VALUES ('alice')`);
      adapter.execRaw(`INSERT INTO "t" ("name") VALUES ('bob')`);

      const rows = await adapter.execute('SELECT * FROM "t" WHERE "name" = ?', ["bob"]);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("bob");
    });

    it("returns empty array for no results", async () => {
      adapter.execRaw('CREATE TABLE "t" ("name" TEXT)');
      const rows = await adapter.execute('SELECT * FROM "t"');
      expect(rows).toEqual([]);
    });
  });

  describe("executeMutation", () => {
    it("returns last insert rowid for INSERT", async () => {
      adapter.execRaw('CREATE TABLE "t" ("id" INTEGER PRIMARY KEY, "name" TEXT)');
      const id1 = await adapter.executeMutation('INSERT INTO "t" ("name") VALUES (?)', ["alice"]);
      const id2 = await adapter.executeMutation('INSERT INTO "t" ("name") VALUES (?)', ["bob"]);
      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });

    it("returns rows modified for UPDATE", async () => {
      adapter.execRaw('CREATE TABLE "t" ("name" TEXT)');
      adapter.execRaw(`INSERT INTO "t" VALUES ('a')`);
      adapter.execRaw(`INSERT INTO "t" VALUES ('b')`);

      const changed = await adapter.executeMutation('UPDATE "t" SET "name" = ?', ["x"]);
      expect(changed).toBe(2);
    });

    it("returns rows modified for DELETE", async () => {
      adapter.execRaw('CREATE TABLE "t" ("name" TEXT)');
      adapter.execRaw(`INSERT INTO "t" VALUES ('a')`);
      adapter.execRaw(`INSERT INTO "t" VALUES ('b')`);

      const changed = await adapter.executeMutation('DELETE FROM "t" WHERE "name" = ?', ["a"]);
      expect(changed).toBe(1);
    });
  });

  describe("transactions", () => {
    it("commits changes", async () => {
      adapter.execRaw('CREATE TABLE "t" ("n" INTEGER)');
      await adapter.beginTransaction();
      await adapter.executeMutation('INSERT INTO "t" VALUES (1)');
      await adapter.commit();

      const rows = await adapter.execute('SELECT * FROM "t"');
      expect(rows).toHaveLength(1);
    });

    it("rolls back changes", async () => {
      adapter.execRaw('CREATE TABLE "t" ("n" INTEGER)');
      await adapter.executeMutation('INSERT INTO "t" VALUES (1)');
      await adapter.beginTransaction();
      await adapter.executeMutation('INSERT INTO "t" VALUES (2)');
      await adapter.rollback();

      const rows = await adapter.execute('SELECT * FROM "t"');
      expect(rows).toHaveLength(1);
    });
  });

  describe("savepoints", () => {
    it("supports nested savepoints", async () => {
      adapter.execRaw('CREATE TABLE "t" ("n" INTEGER)');
      await adapter.beginTransaction();
      await adapter.executeMutation('INSERT INTO "t" VALUES (1)');
      await adapter.createSavepoint("sp1");
      await adapter.executeMutation('INSERT INTO "t" VALUES (2)');
      await adapter.rollbackToSavepoint("sp1");
      await adapter.commit();

      const rows = await adapter.execute('SELECT * FROM "t"');
      expect(rows).toHaveLength(1);
      expect(rows[0].n).toBe(1);
    });

    it("release savepoint keeps changes", async () => {
      adapter.execRaw('CREATE TABLE "t" ("n" INTEGER)');
      await adapter.beginTransaction();
      await adapter.createSavepoint("sp1");
      await adapter.executeMutation('INSERT INTO "t" VALUES (1)');
      await adapter.releaseSavepoint("sp1");
      await adapter.commit();

      const rows = await adapter.execute('SELECT * FROM "t"');
      expect(rows).toHaveLength(1);
    });
  });

  describe("getTables", () => {
    it("lists user tables", () => {
      adapter.execRaw('CREATE TABLE "users" ("id" INTEGER)');
      adapter.execRaw('CREATE TABLE "posts" ("id" INTEGER)');

      const tables = adapter.getTables();
      expect(tables).toContain("users");
      expect(tables).toContain("posts");
    });

    it("excludes sqlite internal tables", () => {
      adapter.execRaw('CREATE TABLE "t" ("id" INTEGER)');
      const tables = adapter.getTables();
      expect(tables.some((t) => t.startsWith("sqlite_"))).toBe(false);
    });
  });

  describe("getColumns", () => {
    it("returns column info", () => {
      adapter.execRaw(
        'CREATE TABLE "users" ("id" INTEGER PRIMARY KEY, "name" TEXT NOT NULL, "age" INTEGER)',
      );

      const cols = adapter.getColumns("users");
      expect(cols).toHaveLength(3);

      const id = cols.find((c) => c.name === "id")!;
      expect(id.type).toBe("INTEGER");
      expect(id.pk).toBe(true);

      const name = cols.find((c) => c.name === "name")!;
      expect(name.type).toBe("TEXT");
      expect(name.notnull).toBe(true);

      const age = cols.find((c) => c.name === "age")!;
      expect(age.notnull).toBe(false);
      expect(age.pk).toBe(false);
    });
  });

  describe("execRaw", () => {
    it("returns columns and values", () => {
      adapter.execRaw('CREATE TABLE "t" ("a" INTEGER, "b" TEXT)');
      adapter.execRaw(`INSERT INTO "t" VALUES (1, 'x')`);

      const results = adapter.execRaw('SELECT * FROM "t"');
      expect(results).toHaveLength(1);
      expect(results[0].columns).toEqual(["a", "b"]);
      expect(results[0].values).toEqual([[1, "x"]]);
    });

    it("returns empty for no-result statements", () => {
      const results = adapter.execRaw('CREATE TABLE "t" ("a" INTEGER)');
      expect(results).toEqual([]);
    });
  });

  describe("explain", () => {
    it("returns a query plan string", async () => {
      adapter.execRaw('CREATE TABLE "t" ("id" INTEGER PRIMARY KEY, "name" TEXT)');
      const plan = await adapter.explain!('SELECT * FROM "t" WHERE "id" = 1');
      expect(typeof plan).toBe("string");
      expect(plan.length).toBeGreaterThan(0);
    });
  });
});
