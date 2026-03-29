import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("sql.js", async () => {
  const actual = await vi.importActual<typeof import("sql.js")>("sql.js");
  return { default: () => actual.default() };
});

import { createRuntime, type Runtime } from "./runtime.js";

let runtime: Runtime;

beforeEach(async () => {
  runtime = await createRuntime();
  for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
  runtime.clearMigrations();

  // Create table and define model class, stash on globalThis for reuse
  await runtime.executeCode(`
    await Schema.define(adapter, (schema) => {
      schema.createTable("users", (t) => {
        t.string("name");
        t.string("email");
        t.integer("age");
        t.timestamps();
      });
    });

    class User extends Base {
      static tableName = "users";
      static {
        this.attribute("name", "string");
        this.attribute("email", "string");
        this.attribute("age", "integer");
        this.attribute("created_at", "datetime");
        this.attribute("updated_at", "datetime");
      }
    }
    globalThis._User = User;
  `);
});

function userCode(code: string): Promise<unknown> {
  return runtime.executeCode(`const User = globalThis._User;\n${code}`);
}

describe("ActiveRecord integration in Frontiers", () => {
  describe("Model.create", () => {
    it("creates a record and returns it", async () => {
      const result = await userCode(`
        const user = await User.create({ name: "Alice", email: "alice@test.com", age: 30 });
        return { id: user.id, name: user.name, email: user.email };
      `);
      const cast = result as { id: number; name: string; email: string };
      expect(cast.id).toBeGreaterThan(0);
      expect(cast.name).toBe("Alice");
      expect(cast.email).toBe("alice@test.com");
    });
  });

  describe("Model.find", () => {
    it("finds a record by id", async () => {
      await userCode(`await User.create({ name: "Alice", email: "a@t.com", age: 30 });`);
      const result = await userCode(`
        const user = await User.find(1);
        return user.name;
      `);
      expect(result).toBe("Alice");
    });
  });

  describe("Model.all", () => {
    it("returns all records", async () => {
      await userCode(`
        await User.create({ name: "Alice", email: "a@t.com", age: 30 });
        await User.create({ name: "Bob", email: "b@t.com", age: 25 });
      `);
      const result = await userCode(`return (await User.all().toArray()).length;`);
      expect(result).toBe(2);
    });
  });

  describe("Model.first", () => {
    it("returns the first record", async () => {
      await userCode(`
        await User.create({ name: "Alice", email: "a@t.com", age: 30 });
        await User.create({ name: "Bob", email: "b@t.com", age: 25 });
      `);
      const result = await userCode(`return (await User.first())?.name;`);
      expect(result).toBe("Alice");
    });
  });

  describe("Model.where", () => {
    it("filters by conditions", async () => {
      await userCode(`
        await User.create({ name: "Alice", email: "a@t.com", age: 30 });
        await User.create({ name: "Bob", email: "b@t.com", age: 25 });
        await User.create({ name: "Charlie", email: "c@t.com", age: 30 });
      `);
      const result = await userCode(`
        const users = await User.where({ age: 30 }).toArray();
        return users.map(u => u.name).sort();
      `);
      expect(result).toEqual(["Alice", "Charlie"]);
    });
  });

  describe("Model.findBy", () => {
    it("finds one by attributes", async () => {
      await userCode(`
        await User.create({ name: "Alice", email: "alice@test.com", age: 30 });
        await User.create({ name: "Bob", email: "bob@test.com", age: 25 });
      `);
      const result = await userCode(`return (await User.findBy({ email: "bob@test.com" }))?.name;`);
      expect(result).toBe("Bob");
    });
  });

  describe("Model.update", () => {
    it("updates a record by id", async () => {
      await userCode(`await User.create({ name: "Alice", email: "a@t.com", age: 30 });`);
      const result = await userCode(`return (await User.update(1, { name: "Alicia" })).name;`);
      expect(result).toBe("Alicia");
    });
  });

  describe("Model.destroy", () => {
    it("destroys a record", async () => {
      await userCode(`await User.create({ name: "Alice", email: "a@t.com", age: 30 });`);
      await userCode(`await User.destroy(1);`);
      const result = await userCode(`return (await User.all().toArray()).length;`);
      expect(result).toBe(0);
    });
  });

  describe("chained queries", () => {
    it("where + order + limit", async () => {
      await userCode(`
        await User.create({ name: "Alice", email: "a@t.com", age: 30 });
        await User.create({ name: "Bob", email: "b@t.com", age: 25 });
        await User.create({ name: "Charlie", email: "c@t.com", age: 35 });
      `);
      const result = await userCode(`
        return (await User.where("age > ?", 24).order("age").limit(2).toArray()).map(u => u.name);
      `);
      expect(result).toEqual(["Bob", "Alice"]);
    });
  });
});
