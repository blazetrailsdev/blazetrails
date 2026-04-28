import { describe, it, expect, vi } from "vitest";
import { createAndMigrate, eachDatabase, createAndLoadSchema } from "./test-databases.js";
import { createTestAdapter } from "./test-adapter.js";
import type { MigrationProxy } from "./migration.js";
import { Base } from "./base.js";
import type { DatabaseConfigurations } from "./database-configurations.js";
import { DatabaseTasks } from "./tasks/database-tasks.js";

describe("TestDatabasesTest", () => {
  it("databases are created", async () => {
    const mockReconstructFromSchema = vi
      .spyOn(DatabaseTasks, "reconstructFromSchema")
      .mockResolvedValue(undefined);
    const connectionHandling = await import("./connection-handling.js");
    const mockEstablishConnection = vi
      .spyOn(connectionHandling, "establishConnection")
      .mockResolvedValue(undefined);

    const mockConfig: any = {};
    Object.defineProperty(mockConfig, "_database", {
      set: function (val: string) {
        this.__database = val;
      },
    });
    Object.defineProperty(mockConfig, "database", {
      get: function () {
        return this.__database || "test/db/primary.sqlite3";
      },
    });
    mockConfig.adapter = "sqlite3";

    const mockConfigurations = {
      configsFor: vi.fn().mockReturnValue([mockConfig]),
    } as any as DatabaseConfigurations;

    const mockModelClass = {
      configurations: mockConfigurations,
    } as any as typeof Base;

    await createAndLoadSchema(mockModelClass, 2, { envName: "arunit" });

    expect(mockConfig.database).toBe("test/db/primary.sqlite3-2");
    expect(mockReconstructFromSchema).toHaveBeenCalledWith(
      mockConfig,
      DatabaseTasks.schemaFormat,
      undefined,
    );
    expect(mockEstablishConnection).toHaveBeenCalledWith(mockModelClass);

    mockReconstructFromSchema.mockRestore();
    mockEstablishConnection.mockRestore();
  });

  it("create databases after fork", async () => {
    const mockReconstructFromSchema = vi
      .spyOn(DatabaseTasks, "reconstructFromSchema")
      .mockResolvedValue(undefined);
    const connectionHandling = await import("./connection-handling.js");
    const mockEstablishConnection = vi
      .spyOn(connectionHandling, "establishConnection")
      .mockResolvedValue(undefined);

    const mockConfig: any = {};
    Object.defineProperty(mockConfig, "_database", {
      set: function (val: string) {
        this.__database = val;
      },
    });
    Object.defineProperty(mockConfig, "database", {
      get: function () {
        return this.__database || "test/db/primary.sqlite3";
      },
    });
    mockConfig.adapter = "sqlite3";

    const mockConfigurations = {
      configsFor: vi.fn().mockReturnValue([mockConfig]),
    } as any as DatabaseConfigurations;

    const mockModelClass = {
      configurations: mockConfigurations,
    } as any as typeof Base;

    await createAndLoadSchema(mockModelClass, 42, { envName: "arunit" });

    expect(mockConfig.database).toBe("test/db/primary.sqlite3-42");
    expect(mockReconstructFromSchema).toHaveBeenCalled();

    mockReconstructFromSchema.mockRestore();
    mockEstablishConnection.mockRestore();
  });

  it("order of configurations isnt changed by test databases", async () => {
    const mockReconstructFromSchema = vi
      .spyOn(DatabaseTasks, "reconstructFromSchema")
      .mockResolvedValue(undefined);
    const mockEstablishConnection = vi
      .spyOn(await import("./connection-handling.js"), "establishConnection")
      .mockResolvedValue(undefined);

    const configs = [
      { database: "test/db/primary.sqlite3", adapter: "sqlite3", name: "primary" },
      { database: "test/db/replica.sqlite3", adapter: "sqlite3", name: "replica" },
    ];

    const mockConfigurations = {
      configsFor: vi.fn().mockReturnValue(configs),
    } as any as DatabaseConfigurations;

    const mockModelClass = {
      configurations: mockConfigurations,
    } as any as typeof Base;

    await createAndLoadSchema(mockModelClass, 42, { envName: "arunit" });

    const configNames = configs.map((c: any) => c.name);
    expect(configNames).toEqual(["primary", "replica"]);

    mockReconstructFromSchema.mockRestore();
    mockEstablishConnection.mockRestore();
  });

  it("createAndMigrate runs migrations on all adapters", async () => {
    const adapter = createTestAdapter();
    const log: string[] = [];
    const migrations: MigrationProxy[] = [
      {
        version: "1",
        name: "M1",
        migration: () => ({
          up: async () => {
            log.push("up");
          },
          down: async () => {},
        }),
      },
    ];

    await createAndMigrate([adapter], migrations);
    expect(log).toEqual(["up"]);
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
