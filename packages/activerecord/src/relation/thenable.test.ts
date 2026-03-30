import { describe, it, expect, beforeEach } from "vitest";
import { Base } from "../index.js";
import { createTestAdapter } from "../test-adapter.js";
import type { DatabaseAdapter } from "../adapter.js";

describe("Thenable", () => {
  let adapter: DatabaseAdapter;
  let User: typeof Base;

  beforeEach(() => {
    adapter = createTestAdapter();
    User = class User extends Base {
      static {
        this.attribute("id", "integer");
        this.attribute("name", "string");
        this.attribute("active", "integer");
        this.adapter = adapter;
      }
    };
  });

  it("Relation is directly awaitable", async () => {
    await User.create({ name: "Alice", active: 1 });
    await User.create({ name: "Bob", active: 1 });

    const users = await User.where({ active: 1 });
    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(2);
  });

  it("Relation .then() chains work", async () => {
    await User.create({ name: "Alice", active: 1 });
    await User.create({ name: "Bob", active: 1 });

    const names = await User.where({ active: 1 }).then((records: Base[]) =>
      records.map((r: Base) => r.readAttribute("name")),
    );
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");
  });

  it("chained relation remains thenable", async () => {
    await User.create({ name: "Alice", active: 1 });
    await User.create({ name: "Bob", active: 1 });

    const users = await User.where({ active: 1 }).order("name").limit(1);
    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(1);
    expect(users[0].readAttribute("name")).toBe("Alice");
  });

  it("works with Promise.all", async () => {
    await User.create({ name: "Alice", active: 1 });
    await User.create({ name: "Bob", active: 1 });
    await User.create({ name: "Charlie", active: 0 });

    const [active, inactive] = await Promise.all([
      User.where({ active: 1 }),
      User.where({ active: 0 }),
    ]);
    expect(active).toHaveLength(2);
    expect(inactive).toHaveLength(1);
  });

  it("does not eagerly evaluate on construction", async () => {
    await User.create({ name: "Alice", active: 1 });

    let queryCount = 0;
    const originalExecute = adapter.execute.bind(adapter);
    adapter.execute = async (...args: any[]) => {
      queryCount++;
      return (originalExecute as any)(...args);
    };

    const relation = User.where({ active: 1 });
    expect(queryCount).toBe(0);

    await relation;
    expect(queryCount).toBe(1);

    adapter.execute = originalExecute;
  });

  it("Relation is not instanceof Promise", () => {
    const relation = User.where({ active: 1 });
    expect(relation).not.toBeInstanceOf(Promise);
  });

  it(".toArray() still works", async () => {
    await User.create({ name: "Alice", active: 1 });

    const users = await User.where({ active: 1 }).toArray();
    expect(Array.isArray(users)).toBe(true);
    expect(users).toHaveLength(1);
  });
});
