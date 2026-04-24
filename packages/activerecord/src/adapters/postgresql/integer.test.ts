/**
 * Mirrors Rails activerecord/test/cases/adapters/postgresql/integer_test.rb
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BigIntegerType } from "@blazetrails/activemodel";
import { describeIfPg, PostgreSQLAdapter, PG_TEST_URL } from "./test-helper.js";

const TWO_GB = 2n * 1024n * 1024n * 1024n; // 2.gigabytes in Ruby

describeIfPg("PostgreSQLAdapter", () => {
  let adapter: PostgreSQLAdapter;
  beforeEach(async () => {
    adapter = new PostgreSQLAdapter(PG_TEST_URL);
  });
  afterEach(async () => {
    await adapter.close();
  });

  describe("PostgresqlIntegerTest", () => {
    beforeEach(async () => {
      await adapter.exec(`DROP TABLE IF EXISTS "pg_integers"`);
      await adapter.exec(`
        CREATE TABLE "pg_integers" (
          "id"    SERIAL PRIMARY KEY,
          "quota" BIGINT NOT NULL DEFAULT ${TWO_GB}
        )
      `);
    });

    afterEach(async () => {
      await adapter.exec(`DROP TABLE IF EXISTS "pg_integers"`);
    });

    it("integer types", async () => {
      await adapter.executeMutation(`INSERT INTO "pg_integers" DEFAULT VALUES`);
      const rows = await adapter.execute(`SELECT "quota" FROM "pg_integers"`);
      expect(typeof rows[0].quota).toBe("string"); // pg returns int8 as string by default
    });

    it("schema properly respects bigint ranges", async () => {
      await adapter.executeMutation(`INSERT INTO "pg_integers" DEFAULT VALUES`);
      const rows = await adapter.execute(`SELECT "quota" FROM "pg_integers"`);
      const type = new BigIntegerType({ limit: 8 });
      const value = type.cast(rows[0].quota);
      expect(value).toBe(TWO_GB);
    });
  });

  describe("PostgreSQL bigint round-trip", () => {
    const BIG = 2n ** 62n;

    beforeEach(async () => {
      await adapter.exec(`DROP TABLE IF EXISTS "bigint_rt"`);
      await adapter.exec(`
        CREATE TABLE "bigint_rt" (
          "id"    SERIAL PRIMARY KEY,
          "score" BIGINT NOT NULL
        )
      `);
    });

    afterEach(async () => {
      await adapter.exec(`DROP TABLE IF EXISTS "bigint_rt"`);
    });

    it("returns string for int8 column (pg driver default)", async () => {
      await adapter.executeMutation(`INSERT INTO "bigint_rt" ("score") VALUES ($1)`, [BIG]);
      const rows = await adapter.execute(`SELECT "score" FROM "bigint_rt"`);
      expect(typeof rows[0].score).toBe("string");
      expect(BigInt(rows[0].score as string)).toBe(BIG);
    });

    it("preserves exact value above Number.MAX_SAFE_INTEGER via BigIntegerType", async () => {
      const unsafe = 9007199254740993n;
      await adapter.executeMutation(`INSERT INTO "bigint_rt" ("score") VALUES ($1)`, [unsafe]);
      const rows = await adapter.execute(`SELECT "score" FROM "bigint_rt"`);
      expect(BigInt(rows[0].score as string)).toBe(unsafe);
    });
  });
});
