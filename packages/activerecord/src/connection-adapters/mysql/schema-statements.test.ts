import { describe, it, expect } from "vitest";
import {
  isRowFormatDynamicByDefault,
  defaultRowFormat,
  validPrimaryKeyOptions,
  createTableDefinition,
  defaultType,
  fetchTypeMetadata,
  extractForeignKeyAction,
  addIndexLength,
  quotedScope,
  extractSchemaQualifiedName,
  typeWithSizeToSql,
  limitToSize,
  integerToSql,
} from "./schema-statements.js";

describe("MySQL::SchemaStatements", () => {
  it("isRowFormatDynamicByDefault: MariaDB >= 10.2.2 is true", () => {
    expect(isRowFormatDynamicByDefault(true, "10.2.2")).toBe(true);
    expect(isRowFormatDynamicByDefault(true, "10.2.1")).toBe(false);
  });

  it("isRowFormatDynamicByDefault: MySQL >= 5.7.9 is true", () => {
    expect(isRowFormatDynamicByDefault(false, "5.7.9")).toBe(true);
    expect(isRowFormatDynamicByDefault(false, "5.7.8")).toBe(false);
  });

  it("defaultRowFormat: null when dynamic by default", () => {
    expect(defaultRowFormat(false, "8.0.0", true, true)).toBeNull();
  });

  it("defaultRowFormat: ROW_FORMAT=DYNAMIC when innodb settings set", () => {
    expect(defaultRowFormat(false, "5.6.0", true, true)).toBe("ROW_FORMAT=DYNAMIC");
    expect(defaultRowFormat(false, "5.6.0", false, true)).toBeNull();
  });

  it("validPrimaryKeyOptions includes unsigned and autoIncrement", () => {
    const opts = validPrimaryKeyOptions();
    expect(opts).toContain("unsigned");
    expect(opts).toContain("autoIncrement");
    expect(opts).toContain("limit");
  });

  it("createTableDefinition returns MySQL TableDefinition", () => {
    expect(createTableDefinition("users").tableName).toBe("users");
  });

  it("defaultType: parses string/integer/function defaults", () => {
    expect(defaultType("`name` varchar(255) DEFAULT 'admin'", "name")).toBe("string");
    expect(defaultType("`count` int DEFAULT 42", "count")).toBe("integer");
    expect(defaultType("`updated_at` datetime DEFAULT NOW", "updated_at")).toBe("function");
    expect(defaultType(null, "name")).toBeUndefined();
  });

  it("fetchTypeMetadata wraps sqlType with MySQL TypeMetadata", () => {
    const meta = fetchTypeMetadata("varchar(255)", "auto_increment");
    expect(meta.sqlType).toBe("varchar(255)");
    expect(meta.extra).toBe("auto_increment");
    expect(fetchTypeMetadata("int").extra).toBe("");
  });

  it("extractForeignKeyAction: RESTRICT → undefined, others pass through", () => {
    expect(extractForeignKeyAction("RESTRICT")).toBeUndefined();
    expect(extractForeignKeyAction("CASCADE")).toBe("CASCADE");
  });

  it("addIndexLength appends (N) prefix length to column", () => {
    const cols = new Map([
      ["name", "`name`"],
      ["email", "`email`"],
    ]);
    const result = addIndexLength(cols, { length: { email: 20 } });
    expect(result.get("name")).toBe("`name`");
    expect(result.get("email")).toBe("`email`(20)");
  });

  it("extractSchemaQualifiedName splits schema.table", () => {
    expect(extractSchemaQualifiedName("mydb.users")).toEqual(["mydb", "users"]);
    expect(extractSchemaQualifiedName("`mydb`.`users`")).toEqual(["mydb", "users"]);
    expect(extractSchemaQualifiedName("users")).toEqual([null, "users"]);
    expect(extractSchemaQualifiedName(null)).toEqual([null, null]);
  });

  it("quotedScope builds scope hash", () => {
    expect(quotedScope().schema).toBe("database()");
    expect(quotedScope("users").name).toBe("'users'");
    const q = quotedScope("mydb.users");
    expect(q.schema).toBe("'mydb'");
    expect(q.name).toBe("'users'");
    expect(quotedScope(undefined, { type: "BASE TABLE" }).type).toBe("'BASE TABLE'");
  });

  it("typeWithSizeToSql: builds prefixed type names", () => {
    expect(typeWithSizeToSql("text", undefined)).toBe("text");
    expect(typeWithSizeToSql("text", "tiny")).toBe("tinytext");
    expect(typeWithSizeToSql("text", "medium")).toBe("mediumtext");
    expect(typeWithSizeToSql("blob", "long")).toBe("longblob");
    expect(() => typeWithSizeToSql("text", "huge")).toThrow("invalid :size value");
  });

  it("limitToSize: maps byte limits for text/blob/binary", () => {
    expect(limitToSize(255, "text")).toBe("tiny");
    expect(limitToSize(null, "text")).toBeUndefined();
    expect(limitToSize(65536, "text")).toBe("medium");
    expect(limitToSize(16777216, "text")).toBe("long");
    expect(limitToSize(4, "integer")).toBeUndefined();
    expect(() => limitToSize(5_000_000_000, "text")).toThrow();
  });

  it("integerToSql: maps limit to MySQL int types", () => {
    expect(integerToSql(1)).toBe("tinyint");
    expect(integerToSql(2)).toBe("smallint");
    expect(integerToSql(3)).toBe("mediumint");
    expect(integerToSql(null)).toBe("int");
    expect(integerToSql(4)).toBe("int");
    expect(integerToSql(8)).toBe("bigint");
    expect(() => integerToSql(9)).toThrow("No integer type has byte size");
  });
});
