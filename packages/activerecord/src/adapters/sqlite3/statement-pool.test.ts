import { describe, it, expect } from "vitest";
import { SQLite3Adapter } from "../../connection-adapters/sqlite3-adapter.js";

describe("SQLite3StatementPoolTest", () => {
  it.skip("cache is per pid", () => {});

  it("reads statementLimit from the options hash", () => {
    const adapter = new SQLite3Adapter(":memory:", { statementLimit: 7 });
    expect(adapter.statementLimit).toBe(7);
    adapter.disconnectBang();
  });

  it("reads preparedStatements from the options hash", () => {
    const adapter = new SQLite3Adapter(":memory:", { preparedStatements: false });
    expect(adapter.preparedStatements).toBe(false);
    adapter.disconnectBang();
  });

  it("rejects invalid statementLimit at construction time", () => {
    expect(() => new SQLite3Adapter(":memory:", { statementLimit: -1 })).toThrow(RangeError);
    expect(() => new SQLite3Adapter(":memory:", { statementLimit: 1.5 })).toThrow(RangeError);
  });

  it("rejects non-boolean preparedStatements at construction time and via assignment", () => {
    expect(
      () => new SQLite3Adapter(":memory:", { preparedStatements: "false" as unknown as boolean }),
    ).toThrow(TypeError);
    expect(
      () => new SQLite3Adapter(":memory:", { preparedStatements: 0 as unknown as boolean }),
    ).toThrow(TypeError);

    const adapter = new SQLite3Adapter(":memory:");
    expect(() => {
      (adapter as unknown as { preparedStatements: unknown }).preparedStatements = "true";
    }).toThrow(TypeError);
    adapter.disconnectBang();
  });

  it("clearCacheBang clears the pool without throwing on next query", async () => {
    const adapter = new SQLite3Adapter(":memory:");
    await adapter.exec(`CREATE TABLE t (id INTEGER)`);
    await adapter.execute("SELECT * FROM t WHERE id = ?", [1]);
    adapter.clearCacheBang();
    await adapter.execute("SELECT * FROM t WHERE id = ?", [2]);
    adapter.disconnectBang();
  });
});
