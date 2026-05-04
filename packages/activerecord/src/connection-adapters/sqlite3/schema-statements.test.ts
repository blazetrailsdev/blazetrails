import { describe, it, expect, vi } from "vitest";
import {
  schemaCreation,
  createSchemaDumper,
  isVirtualTableExists,
  _extractValueFromDefault,
  isColumnTheRowid,
  dataSourceSql,
  quotedScope,
  assertValidDeferrable,
  extractGeneratedType,
} from "./schema-statements.js";
import { SchemaCreation } from "./schema-creation.js";
import { SchemaDumper } from "./schema-dumper.js";

describe("SQLite3::SchemaStatements", () => {
  describe("schemaCreation", () => {
    it("returns a SQLite3 SchemaCreation instance", () => {
      expect(schemaCreation()).toBeInstanceOf(SchemaCreation);
    });
  });

  describe("createSchemaDumper", () => {
    it("returns a SchemaDumper instance", () => {
      const fakeAdapter = { adapterName: "sqlite" } as any;
      expect(createSchemaDumper(fakeAdapter)).toBeInstanceOf(SchemaDumper);
    });
  });

  describe("isVirtualTableExists", () => {
    it("returns true when a matching virtual table row is found", async () => {
      const fakeAdapter = {
        execute: vi.fn().mockResolvedValue([{ name: "virtual_tab" }]),
      } as any;
      expect(await isVirtualTableExists(fakeAdapter, "virtual_tab")).toBe(true);
    });

    it("returns false when no matching row is found", async () => {
      const fakeAdapter = {
        execute: vi.fn().mockResolvedValue([]),
      } as any;
      expect(await isVirtualTableExists(fakeAdapter, "no_such_table")).toBe(false);
    });

    it("queries sqlite_temp_master for temp schema tables", async () => {
      const fakeAdapter = { execute: vi.fn().mockResolvedValue([]) } as any;
      await isVirtualTableExists(fakeAdapter, "temp.my_vtab");
      expect(fakeAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining("sqlite_temp_master"),
        expect.anything(),
      );
    });
  });

  describe("_extractValueFromDefault", () => {
    it("returns null for null input", () => {
      expect(_extractValueFromDefault(null)).toBeNull();
    });

    it("returns null for NULL string", () => {
      expect(_extractValueFromDefault("NULL")).toBeNull();
      expect(_extractValueFromDefault("null")).toBeNull();
    });

    it("unquotes single-quoted strings", () => {
      expect(_extractValueFromDefault("'hello'")).toBe("hello");
      expect(_extractValueFromDefault("'it''s'")).toBe("it's");
    });

    it("unquotes double-quoted strings", () => {
      expect(_extractValueFromDefault('"hello"')).toBe("hello");
    });

    it("returns numeric strings as-is", () => {
      expect(_extractValueFromDefault("42")).toBe("42");
      expect(_extractValueFromDefault("-3.14")).toBe("-3.14");
    });

    it("converts hex blob literals to Buffer", () => {
      const result = _extractValueFromDefault("x'DEADBEEF'");
      expect(Buffer.isBuffer(result)).toBe(true);
      expect((result as Buffer).toString("hex").toUpperCase()).toBe("DEADBEEF");
    });

    it("returns null for unrecognized expressions", () => {
      expect(_extractValueFromDefault("now()")).toBeNull();
    });
  });

  describe("isColumnTheRowid", () => {
    it("returns true for single INTEGER primary key", () => {
      const field = { type: "INTEGER", pk: 1 };
      const defs = [{ pk: 1 }, { pk: 0 }];
      expect(isColumnTheRowid(field, defs)).toBe(true);
    });

    it("returns false for composite primary key", () => {
      const field = { type: "INTEGER", pk: 1 };
      const defs = [{ pk: 1 }, { pk: 1 }];
      expect(isColumnTheRowid(field, defs)).toBe(false);
    });

    it("returns false for non-INTEGER type", () => {
      const field = { type: "TEXT", pk: 1 };
      expect(isColumnTheRowid(field, [{ pk: 1 }])).toBe(false);
    });

    it("returns false for non-PK column", () => {
      const field = { type: "INTEGER", pk: 0 };
      expect(isColumnTheRowid(field, [{ pk: 0 }])).toBe(false);
    });
  });

  describe("dataSourceSql", () => {
    it("returns default table/view query with no args", () => {
      const sql = dataSourceSql();
      expect(sql).toContain("pragma_table_list");
      expect(sql).toContain("'table','view'");
    });

    it("filters by name when provided", () => {
      expect(dataSourceSql("users")).toContain("name = 'users'");
    });

    it("filters by BASE TABLE type", () => {
      expect(dataSourceSql(undefined, "BASE TABLE")).toContain("'table'");
    });

    it("filters by VIEW type", () => {
      expect(dataSourceSql(undefined, "VIEW")).toContain("'view'");
    });

    it("filters by VIRTUAL TABLE type", () => {
      expect(dataSourceSql(undefined, "VIRTUAL TABLE")).toContain("'virtual'");
    });
  });

  describe("quotedScope", () => {
    it("returns empty scope with no args", () => {
      expect(quotedScope()).toEqual({});
    });

    it("includes quoted name", () => {
      expect(quotedScope("users")).toMatchObject({ name: "'users'" });
    });

    it("escapes single quotes in name", () => {
      expect(quotedScope("o'brien")).toMatchObject({ name: "'o''brien'" });
    });

    it("maps BASE TABLE to table", () => {
      expect(quotedScope(undefined, "BASE TABLE")).toMatchObject({ type: "'table'" });
    });

    it("maps VIEW to view", () => {
      expect(quotedScope(undefined, "VIEW")).toMatchObject({ type: "'view'" });
    });
  });

  describe("assertValidDeferrable", () => {
    it("accepts falsy", () => {
      expect(() => assertValidDeferrable(false)).not.toThrow();
      expect(() => assertValidDeferrable(null)).not.toThrow();
      expect(() => assertValidDeferrable(undefined)).not.toThrow();
    });

    it("accepts 'immediate' and 'deferred'", () => {
      expect(() => assertValidDeferrable("immediate")).not.toThrow();
      expect(() => assertValidDeferrable("deferred")).not.toThrow();
    });

    it("throws for invalid value", () => {
      expect(() => assertValidDeferrable("exclusive")).toThrow();
    });
  });

  describe("extractGeneratedType", () => {
    it("returns 'virtual' for hidden=2", () => {
      expect(extractGeneratedType({ hidden: 2 })).toBe("virtual");
    });

    it("returns 'stored' for hidden=3", () => {
      expect(extractGeneratedType({ hidden: 3 })).toBe("stored");
    });

    it("returns undefined for hidden=0", () => {
      expect(extractGeneratedType({ hidden: 0 })).toBeUndefined();
    });
  });
});
