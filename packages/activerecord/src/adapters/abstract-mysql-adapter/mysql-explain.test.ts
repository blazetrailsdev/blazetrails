/**
 * Mirrors Rails activerecord/test/cases/adapters/abstract_mysql_adapter/mysql_explain_test.rb
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { describeIfMysql, Mysql2Adapter, MYSQL_TEST_URL } from "./test-helper.js";

describeIfMysql("Mysql2Adapter", () => {
  let adapter: Mysql2Adapter;
  beforeEach(async () => {
    adapter = new Mysql2Adapter(MYSQL_TEST_URL);
  });
  afterEach(async () => {
    await adapter.close();
  });

  describe("MysqlExplainTest", () => {
    it("explain for one query", async () => {
      const result = await adapter.explain("SELECT 1");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it.skip("explain with options as symbol", () => {});
    it.skip("explain with options as strings", () => {});
    it.skip("explain options with eager loading", () => {});

    it("Relation#explain on MySQL captures the SELECT via sql.active_record", async () => {
      // End-to-end: the full ExplainRegistry → ExplainSubscriber →
      // adapter.explain pipeline only works on MySQL if execute()
      // emits sql.active_record. Without that, Relation#explain
      // silently falls back to toSql() and reports zero collected
      // queries.
      const { Base } = await import("../../index.js");
      class ExRelMysql extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      await adapter.exec(`DROP TABLE IF EXISTS \`ex_rel_mysqls\``);
      await adapter.exec(
        `CREATE TABLE \`ex_rel_mysqls\` (\`id\` BIGINT AUTO_INCREMENT PRIMARY KEY, \`name\` VARCHAR(255))`,
      );
      try {
        await ExRelMysql.create({ name: "r" });
        const plan = await ExRelMysql.all().explain();
        expect(typeof plan).toBe("string");
        expect(plan.toLowerCase()).toContain("select");
        expect(plan).toContain("ex_rel_mysqls");
        // MySQL buildExplainClause header format:
        expect(plan).toMatch(/EXPLAIN.*for:/);
      } finally {
        await adapter.exec(`DROP TABLE IF EXISTS \`ex_rel_mysqls\``);
      }
    });

    it("Relation#explain on MySQL captures preload queries", async () => {
      const { Base, registerModel } = await import("../../index.js");
      class ExMysqlAuthor extends Base {
        static {
          this.attribute("name", "string");
          this.adapter = adapter;
        }
      }
      class ExMysqlBook extends Base {
        static {
          this.attribute("title", "string");
          this.attribute("ex_mysql_author_id", "integer");
          this.adapter = adapter;
        }
      }
      ExMysqlAuthor.hasMany("exMysqlBooks", { className: "ExMysqlBook" });
      registerModel(ExMysqlAuthor);
      registerModel(ExMysqlBook);
      await adapter.exec(`DROP TABLE IF EXISTS \`ex_mysql_books\``);
      await adapter.exec(`DROP TABLE IF EXISTS \`ex_mysql_authors\``);
      await adapter.exec(
        `CREATE TABLE \`ex_mysql_authors\` (\`id\` BIGINT AUTO_INCREMENT PRIMARY KEY, \`name\` VARCHAR(255))`,
      );
      await adapter.exec(
        `CREATE TABLE \`ex_mysql_books\` (\`id\` BIGINT AUTO_INCREMENT PRIMARY KEY, \`title\` VARCHAR(255), \`ex_mysql_author_id\` INT)`,
      );
      try {
        const a = (await ExMysqlAuthor.create({ name: "A" })) as any;
        await ExMysqlBook.create({ title: "B", ex_mysql_author_id: a.id });

        const plan = await ExMysqlAuthor.all().preload("exMysqlBooks").explain();
        const blocks = plan.split("\n\n").filter((b) => /EXPLAIN/.test(b));
        expect(blocks.length).toBeGreaterThanOrEqual(2);
        expect(plan).toContain("ex_mysql_authors");
        expect(plan).toContain("ex_mysql_books");
      } finally {
        await adapter.exec(`DROP TABLE IF EXISTS \`ex_mysql_books\``);
        await adapter.exec(`DROP TABLE IF EXISTS \`ex_mysql_authors\``);
      }
    });
  });
});
