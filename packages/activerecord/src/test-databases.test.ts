import { describe, it, expect } from "vitest";
import { createAndMigrate, eachDatabase } from "./test-databases.js";
import { createTestAdapter } from "./test-adapter.js";
import type { DatabaseAdapter } from "./adapter.js";
import type { MigrationProxy } from "./migration.js";

function makeMigration(version: string, name: string): MigrationProxy {
  return {
    version,
    name,
    migration: () => ({
      up: async (adapter: DatabaseAdapter) => {
        await adapter.executeMutation(
          `CREATE TABLE IF NOT EXISTS "${name.toLowerCase()}" ("id" INTEGER PRIMARY KEY)`,
        );
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

    const rows = await adapter.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    );
    expect(rows.length).toBe(1);
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
