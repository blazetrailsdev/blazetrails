import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  describeIfMysql,
  Mysql2Adapter,
  MYSQL_TEST_URL,
} from "../abstract-mysql-adapter/test-helper.js";

describeIfMysql("Mysql2Adapter", () => {
  let adapter: Mysql2Adapter;
  beforeEach(async () => {
    adapter = new Mysql2Adapter(MYSQL_TEST_URL);
    await adapter.executeMutation(`DROP TABLE IF EXISTS \`bigint_rt\``);
    await adapter.executeMutation(`
      CREATE TABLE \`bigint_rt\` (
        \`id\`    BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`score\` BIGINT NOT NULL,
        \`count\` INT NOT NULL DEFAULT 0
      )
    `);
  });

  afterEach(async () => {
    await adapter.executeMutation(`DROP TABLE IF EXISTS \`bigint_rt\``);
    await adapter.close();
  });

  describe("MySQL bigint round-trip", () => {
    const BIG = 2n ** 62n;

    it("returns string for BIGINT column (bigNumberStrings:true)", async () => {
      await adapter.executeMutation(`INSERT INTO \`bigint_rt\` (\`score\`) VALUES (?)`, [BIG]);
      const rows = await adapter.execute(`SELECT \`score\` FROM \`bigint_rt\``);
      expect(typeof rows[0].score).toBe("string");
    });

    it("preserves exact value above Number.MAX_SAFE_INTEGER", async () => {
      const unsafe = 9007199254740993n;
      await adapter.executeMutation(`INSERT INTO \`bigint_rt\` (\`score\`) VALUES (?)`, [unsafe]);
      const rows = await adapter.execute(`SELECT \`score\` FROM \`bigint_rt\``);
      expect(BigInt(rows[0].score as string)).toBe(unsafe);
    });

    it("update round-trip preserves value", async () => {
      await adapter.executeMutation(`INSERT INTO \`bigint_rt\` (\`score\`) VALUES (?)`, [BIG]);
      await adapter.executeMutation(`UPDATE \`bigint_rt\` SET \`score\` = ?`, [BIG + 1n]);
      const rows = await adapter.execute(`SELECT \`score\` FROM \`bigint_rt\``);
      expect(BigInt(rows[0].score as string)).toBe(BIG + 1n);
    });
  });
});
