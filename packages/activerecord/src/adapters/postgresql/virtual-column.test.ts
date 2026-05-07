/**
 * Mirrors Rails activerecord/test/cases/adapters/postgresql/virtual_column_test.rb
 */
import { describe, it, beforeEach, afterEach } from "vitest";
import { describeIfPg, PostgreSQLAdapter, PG_TEST_URL } from "./test-helper.js";

describeIfPg("PostgreSQLAdapter", () => {
  let adapter: PostgreSQLAdapter;
  beforeEach(async () => {
    adapter = new PostgreSQLAdapter(PG_TEST_URL);
  });
  afterEach(async () => {
    await adapter.close();
  });

  describe("PostgresqlVirtualColumnTest", () => {
    it.skip("virtual column", async () => {});
    it.skip("virtual column default", async () => {});
    it.skip("virtual column type cast", async () => {});
    it.skip("virtual column write", async () => {});
    it.skip("virtual column schema dump", async () => {});
    it.skip("virtual column migration", async () => {});
    it.skip("virtual column stored", async () => {});
    it.skip("non persisted column", async () => {});
    it.skip("virtual column with full inserts", () => {
      // BLOCKED: adapter-pg — PostgreSQL-specific adapter gap in virtual-column
      // ROOT-CAUSE: adapters/postgresql/virtual-column.ts missing or incomplete Rails parity
      // SCOPE: ~50–200 LOC fix in adapters/postgresql/virtual-column.ts; affects ~10–47 tests in virtual-column.test.ts
    });
    it.skip("stored column", () => {
      // BLOCKED: adapter-pg — PostgreSQL-specific adapter gap in virtual-column
      // ROOT-CAUSE: adapters/postgresql/virtual-column.ts missing or incomplete Rails parity
      // SCOPE: ~50–200 LOC fix in adapters/postgresql/virtual-column.ts; affects ~10–47 tests in virtual-column.test.ts
    });
    it.skip("change table", () => {
      // BLOCKED: adapter-pg — PostgreSQL-specific adapter gap in virtual-column
      // ROOT-CAUSE: adapters/postgresql/virtual-column.ts missing or incomplete Rails parity
      // SCOPE: ~50–200 LOC fix in adapters/postgresql/virtual-column.ts; affects ~10–47 tests in virtual-column.test.ts
    });
    it.skip("build fixture sql", () => {
      // BLOCKED: adapter-pg — PostgreSQL-specific adapter gap in virtual-column
      // ROOT-CAUSE: adapters/postgresql/virtual-column.ts missing or incomplete Rails parity
      // SCOPE: ~50–200 LOC fix in adapters/postgresql/virtual-column.ts; affects ~10–47 tests in virtual-column.test.ts
    });
  });

  describe("PostgresqlXmlTest", () => {
    it.skip("xml column", async () => {});
    it.skip("xml default", async () => {});
    it.skip("xml type cast", async () => {});
    it.skip("xml write", async () => {});
    it.skip("xml schema dump", async () => {});
    it.skip("null xml", async () => {});
    it.skip("round trip", async () => {});
  });
});
