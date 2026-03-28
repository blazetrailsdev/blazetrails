import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock sql.js to use asm build (no WASM) and stub the locateFile
vi.mock("sql.js", async () => {
  const actual = await vi.importActual<typeof import("sql.js")>("sql.js");
  return {
    default: () => actual.default(),
  };
});

import { createRuntime, type Runtime } from "./runtime.js";

let runtime: Runtime;

beforeEach(async () => {
  runtime = await createRuntime();
});

describe("Runtime", () => {
  describe("executeCode", () => {
    it("evaluates and returns a value", async () => {
      const result = await runtime.executeCode("return 1 + 2");
      expect(result).toBe(3);
    });

    it("has access to adapter", async () => {
      const result = await runtime.executeCode(
        `const r = adapter.execRaw("SELECT 42 as n"); return r[0].values[0][0]`,
      );
      expect(result).toBe(42);
    });

    it("has access to Schema", async () => {
      await runtime.executeCode(`
        await Schema.define(adapter, (schema) => {
          schema.createTable("test_table", (t) => {
            t.string("name");
          });
        });
      `);
      expect(runtime.getTables()).toContain("test_table");
    });

    it("has access to runtime for registerMigration", async () => {
      await runtime.executeCode(`
        class M extends Migration {
          version = "1";
          async up() {}
        }
        runtime.registerMigration({ version: "1", name: "M", migration: () => new M() });
      `);
      expect(runtime.getMigrations()).toHaveLength(1);
    });
  });

  describe("executeSQL", () => {
    it("runs raw SQL and returns result sets", () => {
      const results = runtime.executeSQL("SELECT 1 as a, 2 as b");
      expect(results).toHaveLength(1);
      expect(results[0].columns).toEqual(["a", "b"]);
      expect(results[0].values).toEqual([[1, 2]]);
    });
  });

  describe("getTables", () => {
    it("excludes _vfs_files from the listing", () => {
      // _vfs_files is created by VirtualFS internally
      const tables = runtime.getTables();
      expect(tables).not.toContain("_vfs_files");
    });
  });

  describe("VFS integration", () => {
    it("has seeded default files", () => {
      const files = runtime.vfs.list();
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.path === "README.md")).toBe(true);
    });

    it("can write and read files through VFS", () => {
      runtime.vfs.write("test.ts", "hello");
      const file = runtime.vfs.read("test.ts");
      expect(file!.content).toBe("hello");
    });
  });

  describe("database tasks", () => {
    beforeEach(async () => {
      // Clear default seed files to avoid auto-discovery conflicts
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();

      // Register a simple migration using MigrationLike interface
      // Migrator calls migration.up(adapter) / migration.down(adapter),
      // so we use run() which sets this.adapter then delegates to up()/down()
      await runtime.executeCode(`
        class CreateUsers extends Migration {
          version = "20240101000001";
          async up() {
            await this.schema.createTable("users", (t) => {
              t.string("name");
            });
          }
          async down() {
            await this.adapter.executeMutation('DROP TABLE IF EXISTS "users"');
          }
        }
        runtime.registerMigration({
          version: "20240101000001",
          name: "CreateUsers",
          migration: () => {
            const m = new CreateUsers();
            return {
              up: (adapter) => m.run(adapter, "up"),
              down: (adapter) => m.run(adapter, "down"),
            };
          },
        });
      `);
    });

    it("dbMigrate applies pending migrations", async () => {
      const result = await runtime.dbMigrate();
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 migration(s) applied");
      expect(runtime.getTables()).toContain("users");
    });

    it("dbMigrate is idempotent", async () => {
      await runtime.dbMigrate();
      const result = await runtime.dbMigrate();
      expect(result.success).toBe(true);
      expect(result.message).toContain("No pending migrations");
    });

    it("dbMigrateStatus shows up/down", async () => {
      let status = await runtime.dbMigrateStatus();
      expect(status[0].status).toBe("down");

      await runtime.dbMigrate();
      status = await runtime.dbMigrateStatus();
      expect(status[0].status).toBe("up");
    });

    it("dbRollback reverts migrations", async () => {
      await runtime.dbMigrate();
      expect(runtime.getTables()).toContain("users");

      const result = await runtime.dbRollback();
      expect(result.success).toBe(true);
      expect(runtime.getTables()).not.toContain("users");
    });

    it("dbSetup creates tables", async () => {
      const result = await runtime.dbSetup();
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("users");
    });

    it("dbDrop removes all tables but keeps VFS", async () => {
      runtime.vfs.write("test.ts", "keep me");
      await runtime.dbMigrate();
      const result = runtime.dbDrop();
      expect(result.success).toBe(true);
      expect(runtime.getTables()).not.toContain("users");
      // VFS table should still exist (dbDrop filters it out)
      expect(runtime.vfs.list().length).toBeGreaterThan(0);
      expect(runtime.vfs.read("test.ts")!.content).toBe("keep me");
    });

    it("dbReset drops and re-migrates", async () => {
      await runtime.dbMigrate();
      await runtime.executeCode(
        `await adapter.executeMutation('INSERT INTO "users" ("name") VALUES (?)', ["alice"])`,
      );

      const result = await runtime.dbReset();
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("users");
      // Data should be gone after reset
      const rows = await runtime.adapter.execute('SELECT * FROM "users"');
      expect(rows).toHaveLength(0);
    });

    it("dbSeed executes seed code", async () => {
      await runtime.dbMigrate();
      const result = await runtime.dbSeed(
        `await adapter.executeMutation('INSERT INTO "users" ("name") VALUES (?)', ["test"])`,
      );
      expect(result.success).toBe(true);
      const rows = await runtime.adapter.execute('SELECT * FROM "users"');
      expect(rows).toHaveLength(1);
    });

    it("dbSchema dumps CREATE TABLE statements", async () => {
      await runtime.dbMigrate();
      const schema = runtime.dbSchema();
      expect(schema).toContain('CREATE TABLE "users"');
      expect(schema).toContain('"name"');
    });
  });

  describe("multiple migrations with ordering", () => {
    it("applies migrations in version order regardless of registration order", async () => {
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();
      // Register in reverse order
      await runtime.executeCode(`
        class CreatePosts extends Migration {
          version = "20240101000002";
          async up() {
            await this.schema.createTable("posts", (t) => {
              t.string("title");
              t.integer("user_id");
            });
          }
          async down() {
            await this.adapter.executeMutation('DROP TABLE IF EXISTS "posts"');
          }
        }
        class CreateUsers extends Migration {
          version = "20240101000001";
          async up() {
            await this.schema.createTable("users", (t) => {
              t.string("name");
            });
          }
          async down() {
            await this.adapter.executeMutation('DROP TABLE IF EXISTS "users"');
          }
        }
        // Register posts first, users second — should still run users first
        runtime.registerMigration({
          version: "20240101000002",
          name: "CreatePosts",
          migration: () => {
            const m = new CreatePosts();
            return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
          },
        });
        runtime.registerMigration({
          version: "20240101000001",
          name: "CreateUsers",
          migration: () => {
            const m = new CreateUsers();
            return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
          },
        });
      `);

      const result = await runtime.dbMigrate();
      expect(result.success).toBe(true);
      expect(result.message).toContain("2 migration(s) applied");
      expect(runtime.getTables()).toContain("users");
      expect(runtime.getTables()).toContain("posts");
    });

    it("rollback steps reverts correct number of migrations", async () => {
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();
      await runtime.executeCode(`
        class A extends Migration {
          version = "1";
          async up() { await this.schema.createTable("a", (t) => { t.string("x"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "a"'); }
        }
        class B extends Migration {
          version = "2";
          async up() { await this.schema.createTable("b", (t) => { t.string("x"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "b"'); }
        }
        class C extends Migration {
          version = "3";
          async up() { await this.schema.createTable("c", (t) => { t.string("x"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "c"'); }
        }
        for (const [v, n, M] of [["1","A",A],["2","B",B],["3","C",C]]) {
          runtime.registerMigration({
            version: v, name: n,
            migration: () => { const m = new M(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") }; },
          });
        }
      `);

      await runtime.dbMigrate();
      expect(runtime.getTables()).toContain("a");
      expect(runtime.getTables()).toContain("b");
      expect(runtime.getTables()).toContain("c");

      // Rollback 2 steps — should drop c and b but keep a
      await runtime.dbRollback(2);
      expect(runtime.getTables()).toContain("a");
      expect(runtime.getTables()).not.toContain("b");
      expect(runtime.getTables()).not.toContain("c");

      const status = await runtime.dbMigrateStatus();
      expect(status.find((s) => s.name === "A")!.status).toBe("up");
      expect(status.find((s) => s.name === "B")!.status).toBe("down");
      expect(status.find((s) => s.name === "C")!.status).toBe("down");
    });

    it("dbMigrateStatus lists all migrations with correct status", async () => {
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();
      await runtime.executeCode(`
        class X extends Migration {
          version = "100";
          async up() { await this.schema.createTable("x", (t) => { t.string("v"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "x"'); }
        }
        class Y extends Migration {
          version = "200";
          async up() { await this.schema.createTable("y", (t) => { t.string("v"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "y"'); }
        }
        runtime.registerMigration({ version: "100", name: "X", migration: () => { const m = new X(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") }; } });
        runtime.registerMigration({ version: "200", name: "Y", migration: () => { const m = new Y(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") }; } });
      `);

      // Both down initially
      let status = await runtime.dbMigrateStatus();
      expect(status).toHaveLength(2);
      expect(status.every((s) => s.status === "down")).toBe(true);

      // Migrate — both up
      await runtime.dbMigrate();
      status = await runtime.dbMigrateStatus();
      expect(status.every((s) => s.status === "up")).toBe(true);

      // Rollback one — first stays up, second goes down
      await runtime.dbRollback(1);
      status = await runtime.dbMigrateStatus();
      expect(status.find((s) => s.name === "X")!.status).toBe("up");
      expect(status.find((s) => s.name === "Y")!.status).toBe("down");
    });
  });

  describe("auto-discovery of migration files", () => {
    it("dbMigrate auto-loads migration files from db/migrations/", async () => {
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();

      runtime.vfs.write(
        "db/migrations/001_create_items.ts",
        `
        class CreateItems extends Migration {
          version = "1";
          async up() { await this.schema.createTable("items", (t) => { t.string("name"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "items"'); }
        }
        runtime.registerMigration({ version: "1", name: "CreateItems", migration: () => {
          const m = new CreateItems(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
        }});
      `,
      );

      // No manual runAllInDir needed — dbMigrate discovers and loads automatically
      const result = await runtime.dbMigrate();
      expect(result.success).toBe(true);
      expect(result.message).toContain("1 migration(s) applied");
      expect(runtime.getTables()).toContain("items");
    });

    it("dbSetup auto-loads and migrates", async () => {
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();

      runtime.vfs.write(
        "db/migrations/001.ts",
        `
        class M extends Migration {
          version = "1";
          async up() { await this.schema.createTable("things", (t) => { t.string("v"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "things"'); }
        }
        runtime.registerMigration({ version: "1", name: "M", migration: () => {
          const m = new M(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
        }});
      `,
      );

      const result = await runtime.dbSetup();
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("things");
    });

    it("dbReset auto-loads after dropping", async () => {
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();

      runtime.vfs.write(
        "db/migrations/001.ts",
        `
        class M extends Migration {
          version = "1";
          async up() { await this.schema.createTable("widgets", (t) => { t.string("v"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "widgets"'); }
        }
        runtime.registerMigration({ version: "1", name: "M", migration: () => {
          const m = new M(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
        }});
      `,
      );

      // First migrate
      await runtime.dbMigrate();
      expect(runtime.getTables()).toContain("widgets");

      // Reset clears registrations and re-discovers
      runtime.clearMigrations();
      const result = await runtime.dbReset();
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("widgets");
    });

    it("skips already-registered migrations", async () => {
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();

      runtime.vfs.write(
        "db/migrations/001.ts",
        `
        class M extends Migration {
          version = "1";
          async up() { await this.schema.createTable("t", (t) => { t.string("v"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "t"'); }
        }
        runtime.registerMigration({ version: "1", name: "M", migration: () => {
          const m = new M(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
        }});
      `,
      );

      // Migrate twice — second time shouldn't re-run the file
      await runtime.dbMigrate();
      const result = await runtime.dbMigrate();
      expect(result.success).toBe(true);
      expect(result.message).toContain("No pending migrations");
    });
  });

  describe("dbMigrateStatus discovery", () => {
    it("discovers migration files from VFS even without registration", async () => {
      runtime.clearMigrations();
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);

      runtime.vfs.write("db/migrations/001_create_users.ts", "// migration code");
      runtime.vfs.write("db/migrations/002_create_posts.ts", "// migration code");

      const status = await runtime.dbMigrateStatus();
      expect(status).toHaveLength(2);
      expect(status[0].name).toContain("001_create_users");
      expect(status[1].name).toContain("002_create_posts");
      expect(status.every((s) => s.status === "down")).toBe(true);
    });

    it("shows applied versions from schema_migrations table", async () => {
      runtime.clearMigrations();
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);

      // Manually create schema_migrations and insert a version
      await runtime.adapter.executeMutation(
        'CREATE TABLE IF NOT EXISTS "schema_migrations" ("version" VARCHAR(255) NOT NULL PRIMARY KEY)',
      );
      await runtime.adapter.executeMutation(
        'INSERT INTO "schema_migrations" ("version") VALUES (?)',
        ["20240101000001"],
      );

      runtime.vfs.write("db/migrations/20240101000001_create_users.ts", "// code");

      const status = await runtime.dbMigrateStatus();
      expect(status).toHaveLength(1);
      expect(status[0].status).toBe("up");
    });

    it("shows orphaned applied versions with no matching file", async () => {
      runtime.clearMigrations();
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);

      await runtime.adapter.executeMutation(
        'CREATE TABLE IF NOT EXISTS "schema_migrations" ("version" VARCHAR(255) NOT NULL PRIMARY KEY)',
      );
      await runtime.adapter.executeMutation(
        'INSERT INTO "schema_migrations" ("version") VALUES (?)',
        ["99999"],
      );

      const status = await runtime.dbMigrateStatus();
      expect(status).toHaveLength(1);
      expect(status[0].version).toBe("99999");
      expect(status[0].status).toBe("up");
      expect(status[0].name).toContain("(no file)");
    });

    it("prefers registered migrations over file discovery", async () => {
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();

      runtime.vfs.write("db/migrations/001.ts", "// file");

      await runtime.executeCode(`
        class M extends Migration {
          version = "1";
          async up() { await this.schema.createTable("t", (t) => { t.string("x"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "t"'); }
        }
        runtime.registerMigration({ version: "1", name: "RegisteredMigration", migration: () => {
          const m = new M(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
        }});
      `);

      const status = await runtime.dbMigrateStatus();
      // Should use the Migrator (registered migrations), not file discovery
      expect(status).toHaveLength(1);
      expect(status[0].name).toBe("RegisteredMigration");
    });
  });

  describe("runAllInDir", () => {
    it("runs files in sorted order", async () => {
      // Write migration files to VFS in non-sorted order
      runtime.vfs.write(
        "db/migrations/002_create_posts.ts",
        `
        class CreatePosts extends Migration {
          version = "2";
          async up() { await this.schema.createTable("posts", (t) => { t.string("title"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "posts"'); }
        }
        runtime.registerMigration({ version: "2", name: "CreatePosts", migration: () => { const m = new CreatePosts(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") }; } });
      `,
      );
      runtime.vfs.write(
        "db/migrations/001_create_users.ts",
        `
        class CreateUsers extends Migration {
          version = "1";
          async up() { await this.schema.createTable("users", (t) => { t.string("name"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "users"'); }
        }
        runtime.registerMigration({ version: "1", name: "CreateUsers", migration: () => { const m = new CreateUsers(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") }; } });
      `,
      );

      // Run all files in db/migrations — should execute 001 before 002
      const result = await runtime.runAllInDir("db/migrations");
      expect(result.success).toBe(true);
      expect(result.message).toContain("2 file(s)");
      expect(result.output).toBeDefined();
      expect(result.output![0]).toContain("001_create_users");
      expect(result.output![2]).toContain("002_create_posts");

      // Migrations should now be registered
      expect(runtime.getMigrations()).toHaveLength(2);
    });

    it("followed by dbMigrate creates tables", async () => {
      // Clear default seed files to avoid conflicts
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();

      runtime.vfs.write(
        "db/migrations/001.ts",
        `
        class M extends Migration {
          version = "1";
          async up() { await this.schema.createTable("items", (t) => { t.string("name"); }); }
          async down() { await this.adapter.executeMutation('DROP TABLE IF EXISTS "items"'); }
        }
        runtime.registerMigration({ version: "1", name: "M", migration: () => { const m = new M(); return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") }; } });
      `,
      );

      // Step 1: run migration files to register them
      await runtime.runAllInDir("db/migrations");
      // Step 2: actually apply the migrations
      const result = await runtime.dbMigrate();
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("items");
    });

    it("returns success with message for empty directory", async () => {
      const result = await runtime.runAllInDir("nonexistent");
      expect(result.success).toBe(true);
      expect(result.message).toContain("No files");
    });

    it("reports errors from individual files", async () => {
      runtime.vfs.write("db/migrations/001.ts", `throw new Error("broken migration")`);

      const result = await runtime.runAllInDir("db/migrations");
      expect(result.success).toBe(false);
      expect(result.message).toContain("broken migration");
    });
  });

  describe("full migration workflow from VFS files", () => {
    it("write files -> run all -> migrate -> seed -> query", async () => {
      // Clear default files to start clean
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      runtime.clearMigrations();

      // Step 1: Write migration files (like a user would)
      runtime.vfs.write(
        "db/migrations/001_create_products.ts",
        `
        class CreateProducts extends Migration {
          version = "20240101000001";
          async up() {
            await this.schema.createTable("products", (t) => {
              t.string("name");
              t.decimal("price");
              t.integer("stock");
            });
          }
          async down() {
            await this.adapter.executeMutation('DROP TABLE IF EXISTS "products"');
          }
        }
        runtime.registerMigration({
          version: "20240101000001",
          name: "CreateProducts",
          migration: () => {
            const m = new CreateProducts();
            return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
          },
        });
      `,
      );

      runtime.vfs.write(
        "db/seeds.ts",
        `
        await adapter.executeMutation(
          'INSERT INTO "products" ("name", "price", "stock") VALUES (?, ?, ?)',
          ["Widget", 9.99, 100]
        );
        await adapter.executeMutation(
          'INSERT INTO "products" ("name", "price", "stock") VALUES (?, ?, ?)',
          ["Gadget", 24.99, 50]
        );
      `,
      );

      // Step 2: Run migration files to register them
      const runResult = await runtime.runAllInDir("db/migrations");
      expect(runResult.success).toBe(true);

      // Step 3: Apply migrations
      const migrateResult = await runtime.dbMigrate();
      expect(migrateResult.success).toBe(true);
      expect(runtime.getTables()).toContain("products");

      // Step 4: Run seeds
      const seedFile = runtime.vfs.read("db/seeds.ts");
      const seedResult = await runtime.dbSeed(seedFile!.content);
      expect(seedResult.success).toBe(true);

      // Step 5: Query
      const rows = await runtime.adapter.execute('SELECT * FROM "products" ORDER BY "price"');
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe("Widget");
      expect(rows[1].name).toBe("Gadget");

      // Step 6: Verify status
      const status = await runtime.dbMigrateStatus();
      expect(status).toHaveLength(1);
      expect(status[0].status).toBe("up");
      expect(status[0].name).toBe("CreateProducts");

      // Step 7: Rollback
      await runtime.dbRollback();
      expect(runtime.getTables()).not.toContain("products");
      const statusAfter = await runtime.dbMigrateStatus();
      expect(statusAfter[0].status).toBe("down");

      // Step 8: Reset re-applies
      await runtime.dbReset();
      expect(runtime.getTables()).toContain("products");
      // But data is gone (no auto-seed on reset)
      const rowsAfter = await runtime.adapter.execute('SELECT * FROM "products"');
      expect(rowsAfter).toHaveLength(0);
    });
  });

  describe("exportDB / loadDB", () => {
    it("round-trips database state", async () => {
      runtime.vfs.write("test-file.ts", "hello world");
      await runtime.executeCode(`
        await Schema.define(adapter, (s) => {
          s.createTable("items", (t) => { t.string("val"); });
        });
        await adapter.executeMutation('INSERT INTO "items" ("val") VALUES (?)', ["x"]);
      `);

      const bytes = runtime.exportDB();
      expect(bytes.length).toBeGreaterThan(0);

      // Load into fresh runtime
      runtime.loadDB(bytes);

      // VFS files should be preserved
      expect(runtime.vfs.read("test-file.ts")!.content).toBe("hello world");

      // User tables should be preserved
      const rows = await runtime.adapter.execute('SELECT * FROM "items"');
      expect(rows).toHaveLength(1);
      expect(rows[0].val).toBe("x");
    });
  });

  describe("newProject", () => {
    it("resets to a fresh database with default files", async () => {
      runtime.vfs.write("custom.ts", "custom");
      runtime.newProject();

      // Custom file should be gone
      expect(runtime.vfs.read("custom.ts")).toBeNull();
      // Default files should be seeded
      expect(runtime.vfs.read("README.md")).not.toBeNull();
    });
  });

  describe("clearMigrations", () => {
    it("clears registered migrations", async () => {
      await runtime.executeCode(`
        class M extends Migration { version = "1"; async up() {} }
        runtime.registerMigration({ version: "1", name: "M", migration: () => new M() });
      `);
      expect(runtime.getMigrations()).toHaveLength(1);
      runtime.clearMigrations();
      expect(runtime.getMigrations()).toHaveLength(0);
    });
  });
});
