import { describe, it, expect, vi, afterEach } from "vitest";
import { createAndMigrate, eachDatabase, createAndLoadSchema } from "./test-databases.js";
import { createTestAdapter } from "./test-adapter.js";
import type { MigrationProxy } from "./migration.js";
import type { Base } from "./base.js";
import { DatabaseConfigurations } from "./database-configurations.js";
import { DatabaseTasks } from "./tasks/database-tasks.js";

// Build a (minimal) DatabaseConfigurations whose `configsFor` returns the
// supplied stubbed configs. Mirrors the production shape — production code
// calls `(this as any).configurations?.toH?.()` then `fromEnv(...)`, so the
// real Base.configurations is a raw hash; createAndLoadSchema normalizes
// either input. Tests use the post-normalization instance directly.
const stubConfigurations = (configs: unknown[]): DatabaseConfigurations => {
  const dc = new DatabaseConfigurations([]);
  vi.spyOn(dc, "configsFor").mockReturnValue(configs as never);
  return dc;
};

describe("TestDatabasesTest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    const mockConfigurations = stubConfigurations([mockConfig]);

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

    const mockConfigurations = stubConfigurations([mockConfig]);

    const mockModelClass = {
      configurations: mockConfigurations,
    } as any as typeof Base;

    await createAndLoadSchema(mockModelClass, 42, { envName: "arunit" });

    expect(mockConfig.database).toBe("test/db/primary.sqlite3-42");
    expect(mockReconstructFromSchema).toHaveBeenCalled();
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

    const mockConfigurations = stubConfigurations(configs);

    const mockModelClass = {
      configurations: mockConfigurations,
    } as any as typeof Base;

    await createAndLoadSchema(mockModelClass, 42, { envName: "arunit" });

    const configNames = configs.map((c: any) => c.name);
    expect(configNames).toEqual(["primary", "replica"]);
  });

  // Mirrors Rails' `ensure` semantics in test_databases.rb:18-21 — the env
  // restore and reconnect must still happen if reconstruct_from_schema raises.
  it("restores VERBOSE and re-establishes connection after schema load failure", async () => {
    const error = new Error("schema load failed");
    vi.spyOn(DatabaseTasks, "reconstructFromSchema").mockRejectedValue(error);
    const connectionHandling = await import("./connection-handling.js");
    const mockEstablishConnection = vi
      .spyOn(connectionHandling, "establishConnection")
      .mockResolvedValue(undefined);

    const mockConfig: any = {};
    Object.defineProperty(mockConfig, "_database", {
      set(val: string) {
        this.__database = val;
      },
    });
    Object.defineProperty(mockConfig, "database", {
      get() {
        return this.__database || "test/db/primary.sqlite3";
      },
    });
    mockConfig.adapter = "sqlite3";

    const mockModelClass = {
      configurations: stubConfigurations([mockConfig]),
    } as any as typeof Base;

    const originalVerbose = process.env.VERBOSE;
    process.env.VERBOSE = "1";

    try {
      await expect(createAndLoadSchema(mockModelClass, 7, { envName: "arunit" })).rejects.toThrow(
        error,
      );
      expect(mockEstablishConnection).toHaveBeenCalledWith(mockModelClass);
      expect(process.env.VERBOSE).toBe("1");
    } finally {
      if (originalVerbose === undefined) {
        delete process.env.VERBOSE;
      } else {
        process.env.VERBOSE = originalVerbose;
      }
    }
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
