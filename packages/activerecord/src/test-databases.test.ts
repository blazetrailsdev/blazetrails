import { describe, it, expect } from "vitest";
import { createAndMigrate, eachDatabase } from "./test-databases.js";
import { createTestAdapter } from "./test-adapter.js";
import { SchemaStatements } from "./connection-adapters/abstract/schema-statements.js";
import type { DatabaseAdapter } from "./adapter.js";
import type { MigrationProxy } from "./migration.js";

function makeMigration(version: string, name: string): MigrationProxy {
  return {
    version,
    name,
    migration: () => ({
      up: async (adapter: DatabaseAdapter) => {
        const schema = new SchemaStatements(adapter);
        await schema.createTable(name.toLowerCase(), {}, (t) => {
          t.string("label");
        });
      },
      down: async () => {},
    }),
  };
}

describe("TestDatabasesTest", () => {
  it.skip("databases are created", () => {});
  it.skip("create databases after fork", () => {});
  it.skip("order of configurations isnt changed by test databases", () => {});

  it("createAndMigrate runs migrations on all adapters", async () => {
    const adapter = createTestAdapter();
    const migrations = [makeMigration("1", "Users")];

    await createAndMigrate([adapter], migrations);

    const schema = new SchemaStatements(adapter);
    const tables = await schema.tables();
    expect(tables).toContain("users");
  });

  it("eachDatabase iterates all adapters", async () => {
    const adapters = [createTestAdapter(), createTestAdapter(), createTestAdapter()];
    const visited: number[] = [];

    await eachDatabase(adapters, async (_adapter, index) => {
      visited.push(index);
    });

    expect(visited).toEqual([0, 1, 2]);
  });
});
