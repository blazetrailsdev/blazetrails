import { describe, it, expect } from "vitest";
import { SchemaDumper } from "./schema-dumper.js";
import type { SchemaSource } from "../../schema-dumper.js";

const stubSource: SchemaSource = { tables: () => [], columns: () => [], indexes: () => [] };

function makeDumper() {
  return SchemaDumper.create(stubSource) as SchemaDumper;
}

function col(
  o: {
    name?: string;
    type?: string;
    sqlType?: string;
    limit?: number | null;
    precision?: number | null;
    scale?: number | null;
    null?: boolean;
    default?: unknown;
    defaultFunction?: string | null;
    hasDefault?: boolean;
    collation?: string | null;
    bigint?: boolean;
    virtual?: boolean;
    unsigned?: boolean;
    autoIncrement?: boolean;
    extra?: string;
    comment?: string | null;
  } = {},
) {
  return { name: "col", type: "string", sqlType: "varchar(255)", ...o };
}

describe("MySQL::SchemaDumper", () => {
  it("defaultPrimaryKeyType returns bigint", () => {
    expect(makeDumper().defaultPrimaryKeyType()).toBe("bigint");
  });

  describe("schemaType", () => {
    it("returns timestamp for timestamp sql_type", () => {
      expect((makeDumper() as any).schemaType(col({ sqlType: "timestamp" }))).toBe("timestamp");
    });
    it("returns full sql_type for enum", () => {
      expect((makeDumper() as any).schemaType(col({ sqlType: "enum('a','b')" }))).toBe(
        "enum('a','b')",
      );
    });
    it("delegates to super for standard types", () => {
      expect((makeDumper() as any).schemaType(col({ type: "string" }))).toBe("string");
    });
  });

  describe("schemaLimit", () => {
    it("suppresses limit for tinytext", () => {
      expect((makeDumper() as any).schemaLimit(col({ sqlType: "tinytext" }))).toBeUndefined();
    });
    it("suppresses limit for text", () => {
      expect((makeDumper() as any).schemaLimit(col({ sqlType: "text" }))).toBeUndefined();
    });
    it("suppresses limit for longblob", () => {
      expect((makeDumper() as any).schemaLimit(col({ sqlType: "longblob" }))).toBeUndefined();
    });
    it("returns limit for varchar", () => {
      expect((makeDumper() as any).schemaLimit(col({ sqlType: "varchar(100)", limit: 100 }))).toBe(
        "100",
      );
    });
  });

  describe("schemaPrecision", () => {
    it("returns undefined for time with precision 0", () => {
      expect(
        (makeDumper() as any).schemaPrecision(col({ type: "time", sqlType: "time", precision: 0 })),
      ).toBeUndefined();
    });
    it("returns undefined for timestamp with precision 0", () => {
      expect(
        (makeDumper() as any).schemaPrecision(
          col({ type: "datetime", sqlType: "timestamp", precision: 0 }),
        ),
      ).toBeUndefined();
    });
    it("returns nil string for datetime with precision 0", () => {
      expect(
        (makeDumper() as any).schemaPrecision(
          col({ type: "datetime", sqlType: "datetime", precision: 0 }),
        ),
      ).toBe("nil");
    });
    it("returns precision string for datetime with non-default precision", () => {
      expect(
        (makeDumper() as any).schemaPrecision(
          col({ type: "datetime", sqlType: "datetime(3)", precision: 3 }),
        ),
      ).toBe("3");
    });
  });

  describe("schemaCollation", () => {
    it("returns undefined when no collation", () => {
      expect((makeDumper() as any).schemaCollation(col({ collation: null }))).toBeUndefined();
    });
    it("returns JSON collation when no connection", () => {
      expect((makeDumper() as any).schemaCollation(col({ collation: "utf8mb4_unicode_ci" }))).toBe(
        '"utf8mb4_unicode_ci"',
      );
    });
    it("omits collation when it matches cached table collation", () => {
      const d = makeDumper();
      (d as any).connection = {};
      (d as any)._tableCollationCache["users"] = "utf8mb4_unicode_ci";
      d.tableName = "users";
      expect((d as any).schemaCollation(col({ collation: "utf8mb4_unicode_ci" }))).toBeUndefined();
    });
    it("emits collation when it differs from table collation", () => {
      const d = makeDumper();
      (d as any).connection = {};
      (d as any)._tableCollationCache["users"] = "utf8mb4_general_ci";
      d.tableName = "users";
      expect((d as any).schemaCollation(col({ collation: "utf8mb4_unicode_ci" }))).toBe(
        '"utf8mb4_unicode_ci"',
      );
    });
  });

  describe("isDefaultPrimaryKey", () => {
    it("true for bigint autoIncrement non-unsigned", () => {
      expect(
        (makeDumper() as any).isDefaultPrimaryKey(col({ bigint: true, autoIncrement: true })),
      ).toBe(true);
    });
    it("false when unsigned", () => {
      expect(
        (makeDumper() as any).isDefaultPrimaryKey(
          col({ bigint: true, autoIncrement: true, unsigned: true }),
        ),
      ).toBe(false);
    });
    it("false when not autoIncrement", () => {
      expect((makeDumper() as any).isDefaultPrimaryKey(col({ bigint: true }))).toBe(false);
    });
  });

  describe("isExplicitPrimaryKeyDefault", () => {
    it("true for integer without autoIncrement", () => {
      expect((makeDumper() as any).isExplicitPrimaryKeyDefault(col({ type: "integer" }))).toBe(
        true,
      );
    });
    it("false for integer with autoIncrement", () => {
      expect(
        (makeDumper() as any).isExplicitPrimaryKeyDefault(
          col({ type: "integer", autoIncrement: true }),
        ),
      ).toBe(false);
    });
  });

  describe("prepareColumnOptions", () => {
    it("adds unsigned flag", () => {
      expect((makeDumper() as any).prepareColumnOptions(col({ unsigned: true }))["unsigned"]).toBe(
        "true",
      );
    });
    it("adds autoIncrement flag", () => {
      expect(
        (makeDumper() as any).prepareColumnOptions(col({ autoIncrement: true }))["autoIncrement"],
      ).toBe("true");
    });
    it("prepends size key for tinytext", () => {
      const opts = (makeDumper() as any).prepareColumnOptions(col({ sqlType: "tinytext" }));
      expect(Object.keys(opts)[0]).toBe("size");
      expect(opts["size"]).toBe(":tiny");
    });
  });

  describe("columnSpecForPrimaryKey", () => {
    it("removes autoIncrement for integer autoIncrement pk", () => {
      const spec = (makeDumper() as any).columnSpecForPrimaryKey(
        col({ type: "integer", autoIncrement: true }),
      );
      expect(spec["autoIncrement"]).toBeUndefined();
    });
  });
});
