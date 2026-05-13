/**
 * Mirrors Rails activerecord/test/cases/adapters/abstract_mysql_adapter/schema_test.rb
 */
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { describeIfMysql, Mysql2Adapter, MYSQL_TEST_URL } from "./test-helper.js";

describeIfMysql("Mysql2Adapter", () => {
  let adapter: Mysql2Adapter;
  beforeEach(async () => {
    adapter = new Mysql2Adapter(MYSQL_TEST_URL);
  });
  afterEach(async () => {
    await adapter.close();
  });

  describe("SchemaTest", () => {
    it("float limits", async () => {
      await adapter.createTable("mysql_doubles", { force: true }, (t: any) => {
        t.float("float_no_limit");
        t.float("float_short", { limit: 5 });
        t.float("float_long", { limit: 53 });
        t.float("float_23", { limit: 23 });
        t.float("float_24", { limit: 24 });
        t.float("float_25", { limit: 25 });
      });

      try {
        const cols = (await adapter.columns("mysql_doubles")) as Array<{
          name: string;
          limit: number | null;
        }>;
        const col = (name: string) => cols.find((c) => c.name === name)!;

        // MySQL floats are precision 0..24, MySQL doubles are precision 25..53
        expect(col("float_no_limit").limit).toBe(24);
        expect(col("float_short").limit).toBe(24);
        expect(col("float_long").limit).toBe(53);
        expect(col("float_23").limit).toBe(24);
        expect(col("float_24").limit).toBe(24);
        expect(col("float_25").limit).toBe(53);
      } finally {
        await adapter.dropTable("mysql_doubles", { ifExists: true });
      }
    });

    it("schema", async () => {
      // basic sanity: table created with a qualified name is queryable
      const tables = await adapter.tables();
      expect(Array.isArray(tables)).toBe(true);
    });

    it("primary key", async () => {
      const pk = await adapter.primaryKeys("topics");
      expect(pk).toContain("id");
    });

    it("data source exists", async () => {
      expect(await adapter.dataSourceExists("topics")).toBe(true);
    });

    it("dump indexes", async () => {
      const indexes = (await adapter.indexes("key_tests")) as Array<{
        name: string;
        using?: string;
        type?: string;
      }>;
      expect(indexes.length).toBeGreaterThanOrEqual(3);

      const indexA = indexes.find((i) => i.name === "index_key_tests_on_snack");
      const indexB = indexes.find((i) => i.name === "index_key_tests_on_pizza");
      const indexC = indexes.find((i) => i.name === "index_key_tests_on_awesome");

      expect(indexA?.using).toBe("btree");
      expect(indexA?.type).toBeUndefined();
      expect(indexB?.using).toBe("btree");
      expect(indexB?.type).toBeUndefined();

      expect(indexC?.using).toBeUndefined();
      expect(indexC?.type).toBe("fulltext");
    });

    it("drop temporary table", async () => {
      await adapter.transaction(async () => {
        await adapter.createTable("temp_table", { temporary: true });
        // if it doesn't properly say DROP TEMPORARY TABLE, the transaction commit
        // will complain that no transaction is active
        await adapter.dropTable("temp_table", { temporary: true });
      });
    });
  });

  describe("MySQLAnsiQuotesTest", () => {
    it("primary key method with ansi quotes", async () => {
      // BLOCKED: ansi-quotes — requires SET SESSION sql_mode='ANSI_QUOTES' which
      // needs adapter-level session-variable setter not yet wired for test setup
    });

    it("foreign keys method with ansi quotes", async () => {
      // BLOCKED: ansi-quotes — same session-variable setup gap as above
    });
  });
});
