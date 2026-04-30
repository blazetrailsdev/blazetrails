/**
 * Identifier-quoting parity through `sanitizeSqlForAssignment` /
 * `sanitizeSqlHashForAssignment` — verifies the quoter parameter
 * threads dialect-specific identifier quoting through the
 * sanitization helpers, matching Rails' `connection.quote` dispatch.
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeSqlForAssignment,
  sanitizeSqlHashForAssignment,
  sanitizeSqlForConditions,
  type Quoter,
} from "./sanitization.js";

const sqliteQuoter: Quoter = {
  quote: (v) => (typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v)),
  quoteIdentifier: (n) => `"${n.replace(/"/g, '""')}"`,
  quoteTableName: (n) =>
    n
      .split(".")
      .map((p) => `"${p.replace(/"/g, '""')}"`)
      .join("."),
  quoteString: (s) => s.replace(/'/g, "''"),
  castBoundValue: (v) => v,
};

const pgQuoter: Quoter = { ...sqliteQuoter };

const mysqlQuoter: Quoter = {
  quote: (v) => (typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v)),
  quoteIdentifier: (n) => `\`${n.replace(/`/g, "``")}\``,
  quoteTableName: (n) =>
    n
      .split(".")
      .map((p) => `\`${p.replace(/`/g, "``")}\``)
      .join("."),
  quoteString: (s) => s.replace(/'/g, "''"),
  castBoundValue: (v) => v,
};

describe("sanitization quoter threading", () => {
  it("MySQL quoter emits backtick-quoted identifiers", () => {
    expect(sanitizeSqlHashForAssignment({ name: "x" }, "users", undefined, mysqlQuoter)).toBe(
      "`users`.`name` = 'x'",
    );
  });

  it("PostgreSQL quoter emits double-quoted identifiers", () => {
    expect(sanitizeSqlHashForAssignment({ name: "x" }, "users", undefined, pgQuoter)).toBe(
      '"users"."name" = \'x\'',
    );
  });

  it("SQLite quoter emits double-quoted identifiers", () => {
    expect(sanitizeSqlHashForAssignment({ name: "x" }, "users", undefined, sqliteQuoter)).toBe(
      '"users"."name" = \'x\'',
    );
  });

  it("sanitizeSqlForAssignment hash form threads quoter for MySQL", () => {
    expect(sanitizeSqlForAssignment({ name: "x" }, "users", mysqlQuoter)).toBe(
      "`users`.`name` = 'x'",
    );
  });

  it("sanitizeSqlForConditions array form threads quoter through `?` binds", () => {
    expect(sanitizeSqlForConditions(["name = ?", "x"], mysqlQuoter)).toBe("name = 'x'");
  });
});
