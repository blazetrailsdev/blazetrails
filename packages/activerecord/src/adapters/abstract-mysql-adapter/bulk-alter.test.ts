/**
 * Mirrors Rails activerecord/test/cases/migration_test.rb
 * BulkAlterTableMigrationsTest — MySQL/Trilogy-only cases.
 */
import { describe, it } from "vitest";
import { describeIfMysql } from "./test-helper.js";

describeIfMysql("Migration", () => {
  describe("BulkAlterTableMigrationsTest", () => {
    it.skip("updating auto increment", () => {
      // BLOCKED: AUTO_INCREMENT introspection — Column#autoIncrement? not
      // wired through Mysql2Adapter#newColumnFromField yet.
    });
  });
});
