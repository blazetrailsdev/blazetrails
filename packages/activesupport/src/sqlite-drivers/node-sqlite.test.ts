import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SqliteConnection } from "../sqlite-adapter.js";

const nodeMajor = parseInt(process.versions.node.split(".")[0]!, 10);
const hasNodeSqlite = nodeMajor >= 22;

describe.skipIf(!hasNodeSqlite)("SqliteDriver — node-sqlite round-trip", () => {
  let conn: SqliteConnection;
  let nodeSqliteDriver: (typeof import("./node-sqlite.js"))["nodeSqliteDriver"];

  beforeAll(async () => {
    ({ nodeSqliteDriver } = await import("./node-sqlite.js"));
    conn = await nodeSqliteDriver.open({ database: ":memory:" });
    const create = await conn.prepare(
      "CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL, qty INTEGER)",
    );
    await create.run();
    const insert = await conn.prepare("INSERT INTO widgets (name, qty) VALUES (?, ?)");
    await insert.run(["sprocket", 42]);
    await insert.run(["gear", 7]);
  });

  afterAll(async () => {
    await conn.close();
  });

  it("retrieves a row by name", async () => {
    const select = await conn.prepare("SELECT id, name, qty FROM widgets WHERE name = ?");
    const row = (await select.get(["sprocket"])) as Record<string, unknown>;
    expect(row["name"]).toBe("sprocket");
    expect(row["qty"]).toBe(42);
  });

  it("run() returns changes and lastInsertRowid", async () => {
    const insert = await conn.prepare("INSERT INTO widgets (name, qty) VALUES (?, ?)");
    const result = await insert.run(["bolt", 99]);
    expect(result.changes).toBe(1);
    expect(
      typeof result.lastInsertRowid === "number" || typeof result.lastInsertRowid === "bigint",
    ).toBe(true);
  });

  it("returns all rows", async () => {
    const select = await conn.prepare("SELECT id, name, qty FROM widgets ORDER BY id");
    const rows = (await select.all()) as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const names = rows.map((r) => r["name"]);
    expect(names).toContain("sprocket");
    expect(names).toContain("gear");
  });

  it("iterate() yields rows incrementally", async () => {
    const select = await conn.prepare("SELECT id, name FROM widgets ORDER BY id");
    const collected: unknown[] = [];
    for (const row of select.iterate() as Iterable<unknown>) collected.push(row);
    expect(collected.length).toBeGreaterThanOrEqual(2);
  });

  it("named binds work as a single object", async () => {
    const select = await conn.prepare("SELECT qty FROM widgets WHERE name = $name");
    const row = (await select.get({ name: "sprocket" })) as Record<string, unknown>;
    expect(row["qty"]).toBe(42);
  });

  it("setReadBigInts enables bigint returns", async () => {
    const stmt = await conn.prepare("SELECT qty FROM widgets WHERE name = ?");
    stmt.setReadBigInts(true);
    const row = (await stmt.get(["sprocket"])) as Record<string, unknown>;
    expect(typeof row["qty"]).toBe("bigint");
  });

  it("exec runs SQL", async () => {
    await conn.exec("CREATE TABLE IF NOT EXISTS tmp_exec (x INTEGER)");
    await conn.exec("DROP TABLE tmp_exec");
  });

  it("pragma returns a value", async () => {
    const result = await conn.pragma("journal_mode");
    expect(result).toBeDefined();
  });

  it("isOpen() is true while connected", () => {
    expect(conn.isOpen()).toBe(true);
  });

  it("statement.reader is true for SELECT, false for INSERT", async () => {
    const sel = await conn.prepare("SELECT 1");
    expect(sel.reader).toBe(true);
    const ins = await conn.prepare("INSERT INTO widgets (name, qty) VALUES (?, ?)");
    expect(ins.reader).toBe(false);
  });

  it("databaseExists() reports memory databases as present", () => {
    expect(nodeSqliteDriver.databaseExists?.({ database: ":memory:" })).toBe(true);
  });

  it("capabilities reflect node-sqlite traits", () => {
    expect(nodeSqliteDriver.capabilities.inProcessSync).toBe(true);
    expect(nodeSqliteDriver.capabilities.streaming).toBe(true);
    expect(nodeSqliteDriver.capabilities.foreignKeysOnByDefault).toBe(false);
  });
});
