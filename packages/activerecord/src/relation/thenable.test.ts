import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Base, Relation } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("Thenable", () => {
  let adapter: DatabaseAdapter;
  let ThenableUser: typeof Base;

  beforeEach(() => {
    adapter = createTestAdapter();
    ThenableUser = class ThenableUser extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("active", "integer");
        this.adapter = adapter;
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Relation is directly awaitable", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });
    await ThenableUser.create({ name: "Bob", active: 1 });

    const users = await ThenableUser.where({ active: 1 });
    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(2);
  });

  it("Relation .then() chains work", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });
    await ThenableUser.create({ name: "Bob", active: 1 });

    const names = await ThenableUser.where({ active: 1 }).then((records: Base[]) =>
      records.map((r: Base) => r.readAttribute("name")),
    );
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  it("chained relation remains thenable", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });
    await ThenableUser.create({ name: "Bob", active: 1 });

    const users = await ThenableUser.where({ active: 1 }).order("name").limit(1);
    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(1);
    expect(users[0].readAttribute("name")).toBe("Alice");
  });

  it("works with Promise.all", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });
    await ThenableUser.create({ name: "Bob", active: 1 });
    await ThenableUser.create({ name: "Charlie", active: 0 });

    const [active, inactive] = await Promise.all([
      ThenableUser.where({ active: 1 }),
      ThenableUser.where({ active: 0 }),
    ]);
    expect(active).toHaveLength(2);
    expect(inactive).toHaveLength(1);
  });

  it("does not eagerly evaluate on construction", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });

    const spy = vi.spyOn(adapter, "execute");

    try {
      const relation = ThenableUser.where({ active: 1 });
      expect(spy).not.toHaveBeenCalled();

      await relation;
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("Relation is not instanceof Promise", () => {
    const relation = ThenableUser.where({ active: 1 });
    expect(relation).not.toBeInstanceOf(Promise);
  });

  it(".toArray() still works", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });

    const users = await ThenableUser.where({ active: 1 }).toArray();
    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(1);
  });

  it("load() returns the relation, not an array", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });

    const rel = ThenableUser.where({ active: 1 });
    const loaded = await rel.load();
    expect(loaded).toBeInstanceOf(Relation);
    expect(loaded.isLoaded).toBe(true);
  });

  it("reload() returns the relation, not an array", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });

    const rel = ThenableUser.where({ active: 1 });
    await rel.load();
    const reloaded = await rel.reload();
    expect(reloaded).toBeInstanceOf(Relation);
  });

  it("presence() returns the relation when records exist", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });

    const rel = ThenableUser.where({ active: 1 });
    const present = await rel.presence();
    expect(present).toBeInstanceOf(Relation);
  });

  it("presence() returns null when no records exist", async () => {
    const rel = ThenableUser.where({ active: 99 });
    const present = await rel.presence();
    expect(present).toBeNull();
  });

  it("relation remains awaitable after load()", async () => {
    await ThenableUser.create({ name: "Alice", active: 1 });

    const rel = ThenableUser.where({ active: 1 });
    await rel.load();

    // After queueMicrotask restores .then, the relation should be awaitable again
    await new Promise<void>((r) => queueMicrotask(r));
    const users = await rel;
    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(1);
  });
});
