/**
 * Mirrors Rails activerecord/test/cases/migration_test.rb
 * BulkAlterTableMigrationsTest — MySQL/Trilogy-only cases.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { describeIfMysql, Mysql2Adapter, MYSQL_TEST_URL } from "./test-helper.js";

describeIfMysql("Migration", () => {
  let adapter: Mysql2Adapter;
  beforeEach(async () => {
    adapter = new Mysql2Adapter(MYSQL_TEST_URL);
    await adapter.exec("DROP TABLE IF EXISTS delete_me");
    await adapter.exec("CREATE TABLE delete_me (id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY (id))");
  });
  afterEach(async () => {
    await adapter.exec("DROP TABLE IF EXISTS delete_me");
    await adapter.close();
  });

  describe("BulkAlterTableMigrationsTest", () => {
    it("updating auto increment", async () => {
      const ss = adapter.schemaStatements();
      await ss.changeTable("delete_me", { bulk: true }, (t: any) => {
        t.change("id", "bigint", { autoIncrement: true });
      });
      let cols = await adapter.columns("delete_me");
      expect((cols.find((c) => c.name === "id") as any).autoIncrement).toBe(true);

      await ss.changeTable("delete_me", { bulk: true }, (t: any) => {
        t.change("id", "bigint", { autoIncrement: false });
      });
      cols = await adapter.columns("delete_me");
      expect((cols.find((c) => c.name === "id") as any).autoIncrement).toBeFalsy();
    });
  });
});
