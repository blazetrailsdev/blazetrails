import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BigIntegerType } from "@blazetrails/activemodel";
import {
  describeIfMysql,
  Mysql2Adapter,
  MYSQL_TEST_URL,
} from "../abstract-mysql-adapter/test-helper.js";

describeIfMysql("Mysql2Adapter", () => {
  let adapter: Mysql2Adapter;
  const type = new BigIntegerType({ limit: 8 });
  const BIG = 2n ** 62n; // well above Number.MAX_SAFE_INTEGER

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
    it("preserves exact value above Number.MAX_SAFE_INTEGER", async () => {
      const unsafe = 9007199254740993n; // Number.MAX_SAFE_INTEGER + 2
      await adapter.executeMutation(`INSERT INTO \`bigint_rt\` (\`score\`) VALUES (?)`, [unsafe]);
      const rows = await adapter.execute(`SELECT \`score\` FROM \`bigint_rt\``);
      // mysql2 with bigNumberStrings:true returns BIGINT as decimal string
      expect(typeof rows[0].score).toBe("string");
      // BigIntegerType.cast converts to bigint
      expect(type.cast(rows[0].score)).toBe(unsafe);
    });

    it("update round-trip preserves value", async () => {
      await adapter.executeMutation(`INSERT INTO \`bigint_rt\` (\`score\`) VALUES (?)`, [BIG]);
      await adapter.executeMutation(`UPDATE \`bigint_rt\` SET \`score\` = ?`, [BIG + 1n]);
      const rows = await adapter.execute(`SELECT \`score\` FROM \`bigint_rt\``);
      expect(type.cast(rows[0].score)).toBe(BIG + 1n);
    });

    it("INT column in same row is unaffected by bigNumberStrings", async () => {
      await adapter.executeMutation(
        `INSERT INTO \`bigint_rt\` (\`score\`, \`count\`) VALUES (?, ?)`,
        [BIG, 42],
      );
      const rows = await adapter.execute(`SELECT \`score\`, \`count\` FROM \`bigint_rt\``);
      // INT columns are not affected by supportBigNumbers — they return number
      expect(typeof rows[0].count).toBe("number");
      expect(rows[0].count).toBe(42);
    });
  });
});
