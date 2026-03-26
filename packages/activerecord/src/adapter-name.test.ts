import { describe, it, expect } from "vitest";
import { detectAdapterName } from "./adapter-name.js";

describe("detectAdapterName", () => {
  it("returns postgres for PostgresAdapter", () => {
    class PostgresAdapter {}
    expect(detectAdapterName(new PostgresAdapter() as any)).toBe("postgres");
  });

  it("returns postgres for any class containing Postgres", () => {
    class MyPostgresCustomAdapter {}
    expect(detectAdapterName(new MyPostgresCustomAdapter() as any)).toBe("postgres");
  });

  it("returns mysql for MysqlAdapter", () => {
    class MysqlAdapter {}
    expect(detectAdapterName(new MysqlAdapter() as any)).toBe("mysql");
  });

  it("returns mysql for MariaDB adapter", () => {
    class MariaDbAdapter {}
    expect(detectAdapterName(new MariaDbAdapter() as any)).toBe("mysql");
  });

  it("returns sqlite for null adapter", () => {
    expect(detectAdapterName(null)).toBe("sqlite");
  });

  it("returns sqlite for undefined adapter", () => {
    expect(detectAdapterName(undefined)).toBe("sqlite");
  });

  it("returns sqlite for unknown adapter class", () => {
    class UnknownAdapter {}
    expect(detectAdapterName(new UnknownAdapter() as any)).toBe("sqlite");
  });
});
