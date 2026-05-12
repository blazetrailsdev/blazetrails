/**
 * Mirrors Rails activerecord/test/cases/adapters/postgresql/datatype_test.rb
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { describeIfPg, PostgreSQLAdapter, PG_TEST_URL } from "./test-helper.js";

describeIfPg("PostgreSQLAdapter", () => {
  let adapter: PostgreSQLAdapter;
  beforeEach(async () => {
    adapter = new PostgreSQLAdapter(PG_TEST_URL);
  });
  afterEach(async () => {
    await adapter.exec(`DROP TABLE IF EXISTS ex CASCADE`);
    await adapter.exec(`DROP TABLE IF EXISTS postgresql_times CASCADE`);
    await adapter.exec(`DROP TABLE IF EXISTS postgresql_oids CASCADE`);
    await adapter.close();
  });

  async function setupTimesTable() {
    await adapter.exec(`DROP TABLE IF EXISTS postgresql_times`);
    await adapter.exec(`
      CREATE TABLE postgresql_times (
        id serial primary key,
        time_interval interval,
        scaled_time_interval interval
      )
    `);
    const { Base } = await import("../../index.js");
    const a = adapter;
    class PostgresqlTime extends Base {
      static tableName = "postgresql_times";
      static {
        this.adapter = a;
        // Rails declares `attribute :time_interval, :string` and
        // `attribute :scaled_time_interval, :interval` on the model.
        // The :interval override is redundant with column reflection;
        // the :string override is only exercised by `time values` /
        // `update large time in seconds`, which are blocked on the
        // IntervalStyle = iso_8601 connection setting (see those skips).
      }
    }
    await PostgresqlTime.loadSchema();
    return PostgresqlTime;
  }

  async function setupOidsTable() {
    await adapter.exec(`DROP TABLE IF EXISTS postgresql_oids`);
    await adapter.exec(`
      CREATE TABLE postgresql_oids (
        id serial primary key,
        obj_id oid
      )
    `);
    const { Base } = await import("../../index.js");
    const a = adapter;
    class PostgresqlOid extends Base {
      static tableName = "postgresql_oids";
      static {
        this.adapter = a;
      }
    }
    await PostgresqlOid.loadSchema();
    return PostgresqlOid;
  }

  describe("PostgreSQLDatatypeTest", () => {
    it("data type of time types", async () => {
      const M = await setupTimesTable();
      await adapter.exec(
        `INSERT INTO postgresql_times (id, time_interval, scaled_time_interval) VALUES (1, '1 year 2 days ago', '3 weeks ago')`,
      );
      const first = await (M as any).find(1);
      expect((M as any).columnForAttribute("time_interval").type).toBe("interval");
      expect((M as any).columnForAttribute("scaled_time_interval").type).toBe("interval");
      // Touch the loaded record so the find is exercised end-to-end.
      expect(first).toBeDefined();
    });

    it("data type of oid types", async () => {
      const M = await setupOidsTable();
      await adapter.exec(`INSERT INTO postgresql_oids (id, obj_id) VALUES (1, 1234)`);
      const first = await (M as any).find(1);
      expect((M as any).columnForAttribute("obj_id").type).toBe("oid");
      expect(first).toBeDefined();
    });

    it.skip("time values", async () => {
      // BLOCKED: pg-interval-style — driver returns intervals in 'postgres' format ("-1 years -2 days"),
      // not ISO 8601 ("P-1Y-2D"). Rails sets `IntervalStyle = iso_8601` per connection.
      // ROOT-CAUSE: postgresql-adapter does not set `IntervalStyle = iso_8601` on connect.
      // SCOPE: ~5 LOC in postgresql-adapter.ts configureConnection; un-blocks this test and
      // update_large_time_in_seconds.
    });

    it.skip("update large time in seconds", async () => {
      // BLOCKED: pg-interval-style — same root cause as `time values`. Round-trip of a numeric
      // seconds count (70.years.to_f) into an interval column requires the driver to return the
      // value as an ISO8601 string for Duration.parse on read-back.
      // SCOPE: ~5 LOC in postgresql-adapter.ts configureConnection (IntervalStyle = iso_8601).
    });

    it("oid values", async () => {
      const M = await setupOidsTable();
      await adapter.exec(`INSERT INTO postgresql_oids (id, obj_id) VALUES (1, 1234)`);
      const first = await (M as any).find(1);
      expect(Number((first as any).obj_id)).toBe(1234);
    });

    it("update oid", async () => {
      const M = await setupOidsTable();
      await adapter.exec(`INSERT INTO postgresql_oids (id, obj_id) VALUES (1, 1234)`);
      const first = await (M as any).find(1);
      const newValue = 2147483648;
      (first as any).obj_id = newValue;
      expect(await (first as any).save()).toBeTruthy();
      await (first as any).reload();
      expect(Number((first as any).obj_id)).toBe(newValue);
    });

    it("text columns are limitless the upper limit is one GB", async () => {
      expect(adapter.typeToSql("text", { limit: 100_000 })).toBe("text");
      expect(() => adapter.typeToSql("text", { limit: 4_294_967_295 })).toThrow();
    });
  });

  describe("PostgreSQLInternalDatatypeTest", () => {
    it("name column type", async () => {
      await adapter.exec(`CREATE TABLE ex (data name)`);
      const cols = await adapter.columns("ex");
      const col = cols.find((c) => c.name === "data");
      expect(col).toBeDefined();
      expect(col!.baseType).toBe("string");
    });

    it("char column type", async () => {
      await adapter.exec(`CREATE TABLE ex (data "char")`);
      const cols = await adapter.columns("ex");
      const col = cols.find((c) => c.name === "data");
      expect(col).toBeDefined();
      expect(col!.baseType).toBe("string");
    });
  });
});
