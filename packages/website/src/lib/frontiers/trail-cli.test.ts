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
});

function writeMigration(version: string, name: string, tableName: string) {
  runtime.vfs.write(
    `db/migrations/${version}-${name}.ts`,
    `
    class ${name} extends Migration {
      version = "${version}";
      async up() {
        await this.schema.createTable("${tableName}", (t) => { t.string("name"); });
      }
      async down() {
        await this.adapter.executeMutation('DROP TABLE IF EXISTS "${tableName}"');
      }
    }
    runtime.registerMigration({
      version: "${version}",
      name: "${name}",
      migration: () => {
        const m = new ${name}();
        return { up: (a) => m.run(a, "up"), down: (a) => m.run(a, "down") };
      },
    });
  `,
  );
}

describe("Trail CLI", () => {
  describe("new", () => {
    it("scaffolds a full app", async () => {
      const result = await runtime.exec("new my-blog");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("create"))).toBe(true);

      // Check generated files
      expect(runtime.vfs.read("index.html")).not.toBeNull();
      expect(runtime.vfs.read("app/main.ts")).not.toBeNull();
      expect(runtime.vfs.read("config/routes.ts")).not.toBeNull();
      expect(runtime.vfs.read("app/controllers/application-controller.ts")).not.toBeNull();
      expect(runtime.vfs.read("db/seeds.ts")).not.toBeNull();
      expect(runtime.vfs.read("queries/tables.sql")).not.toBeNull();
    });

    it("clears existing files", async () => {
      runtime.vfs.write("old-file.ts", "old");
      await runtime.exec("new fresh-app");
      expect(runtime.vfs.read("old-file.ts")).toBeNull();
    });

    it("sets the app name in generated files", async () => {
      await runtime.exec("new my-store");
      expect(runtime.vfs.read("index.html")!.content).toContain("my-store");
      expect(runtime.vfs.read("app/main.ts")!.content).toContain("my-store");
    });
  });

  describe("generate migration", () => {
    it("creates a migration file", async () => {
      const result = await runtime.exec("generate migration create_users name:string email:string");
      expect(result.success).toBe(true);

      const files = runtime.vfs.list().filter((f) => f.path.startsWith("db/migrations/"));
      expect(files).toHaveLength(1);
      expect(files[0].path).toContain("create-users");
      expect(files[0].content).toContain("createTable");
      expect(files[0].content).toContain('"name"');
      expect(files[0].content).toContain('"email"');
    });

    it("generates a runnable migration", async () => {
      await runtime.exec("generate migration create_products name:string price:decimal");
      const result = await runtime.exec("db:migrate");
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("products");
    });

    it("supports references", async () => {
      await runtime.exec("generate migration create_comments body:text post:references");
      const files = runtime.vfs.list().filter((f) => f.path.startsWith("db/migrations/"));
      expect(files[0].content).toContain("references");
    });
  });

  describe("generate model", () => {
    it("creates model and migration files", async () => {
      const result = await runtime.exec("generate model User name:string email:string age:integer");
      expect(result.success).toBe(true);

      const model = runtime.vfs.read("app/models/user.ts");
      expect(model).not.toBeNull();
      expect(model!.content).toContain("class User");
      expect(model!.content).toContain('"name"');

      const migrations = runtime.vfs.list().filter((f) => f.path.startsWith("db/migrations/"));
      expect(migrations).toHaveLength(1);
      expect(migrations[0].content).toContain("createTable");
    });

    it("model + migrate creates the table", async () => {
      await runtime.exec("generate model Post title:string body:text");
      const result = await runtime.exec("db:migrate");
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("posts");
    });
  });

  describe("scaffold", () => {
    it("generates model, migration, controller, and views", async () => {
      await runtime.exec("new my-app");
      const result = await runtime.exec("scaffold Post title:string body:text published:boolean");
      expect(result.success).toBe(true);

      expect(runtime.vfs.read("app/models/post.ts")).not.toBeNull();
      expect(
        runtime.vfs
          .list()
          .some((f) => f.path.startsWith("db/migrations/") && f.path.includes("create")),
      ).toBe(true);
      expect(runtime.vfs.read("app/controllers/posts-controller.ts")).not.toBeNull();
      // Controller should have real ActionController code, not commented out
      expect(runtime.vfs.read("app/controllers/posts-controller.ts")!.content).toContain(
        "ActionController.Base",
      );
      expect(runtime.vfs.read("app/controllers/posts-controller.ts")!.content).toContain(
        "registerController",
      );
    });

    it("updates routes", async () => {
      await runtime.exec("new my-app");
      await runtime.exec("scaffold Article title:string");
      const routes = runtime.vfs.read("config/routes.ts");
      expect(routes!.content).toContain("articles");
    });

    it("scaffold + migrate creates the table", async () => {
      await runtime.exec("new my-app");
      await runtime.exec("scaffold Product name:string price:decimal");
      const result = await runtime.exec("db:migrate");
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("products");
    });

    it("full scaffold workflow: new -> scaffold -> migrate -> seed -> query", async () => {
      await runtime.exec("new shop");
      await runtime.exec("scaffold Product name:string price:decimal stock:integer");
      await runtime.exec("db:migrate");

      // Write seed data
      runtime.vfs.write(
        "db/seeds.ts",
        `
        await adapter.executeMutation('INSERT INTO "products" ("name","price","stock","created_at","updated_at") VALUES (?,?,?,datetime("now"),datetime("now"))', ["Widget", 9.99, 100]);
      `,
      );
      await runtime.exec("db:seed");

      const rows = await runtime.adapter.execute('SELECT * FROM "products"');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Widget");
    });
  });

  describe("g alias", () => {
    it("works as shorthand for generate", async () => {
      const result = await runtime.exec("g model Item name:string");
      expect(result.success).toBe(true);
      expect(runtime.vfs.read("app/models/item.ts")).not.toBeNull();
    });
  });

  describe("db:migrate", () => {
    it("discovers and runs migration files", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      writeMigration("20240101000002", "CreatePosts", "posts");

      const result = await runtime.exec("db:migrate");
      expect(result.success).toBe(true);
      expect(runtime.getTables()).toContain("users");
      expect(runtime.getTables()).toContain("posts");
    });

    it("is idempotent", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      await runtime.exec("db:migrate");
      const result = await runtime.exec("db:migrate");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("up to date"))).toBe(true);
    });

    it("supports --version", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      writeMigration("20240101000002", "CreatePosts", "posts");

      await runtime.exec("db:migrate --version 20240101000001");
      expect(runtime.getTables()).toContain("users");
      expect(runtime.getTables()).not.toContain("posts");
    });
  });

  describe("db:rollback", () => {
    it("rolls back the last migration", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      writeMigration("20240101000002", "CreatePosts", "posts");
      await runtime.exec("db:migrate");

      await runtime.exec("db:rollback");
      expect(runtime.getTables()).toContain("users");
      expect(runtime.getTables()).not.toContain("posts");
    });

    it("supports --step", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      writeMigration("20240101000002", "CreatePosts", "posts");
      await runtime.exec("db:migrate");

      await runtime.exec("db:rollback --step 2");
      expect(runtime.getTables()).not.toContain("users");
      expect(runtime.getTables()).not.toContain("posts");
    });
  });

  describe("db:migrate:status", () => {
    it("shows status table", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      await runtime.exec("db:migrate");

      const result = await runtime.exec("db:migrate:status");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("up") && l.includes("CreateUsers"))).toBe(true);
    });
  });

  describe("db:seed", () => {
    it("runs db/seeds.ts", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      runtime.vfs.write(
        "db/seeds.ts",
        `await adapter.executeMutation('INSERT INTO "users" ("name") VALUES (?)', ["Alice"]);`,
      );
      await runtime.exec("db:migrate");

      const result = await runtime.exec("db:seed");
      expect(result.success).toBe(true);
      const rows = await runtime.adapter.execute('SELECT * FROM "users"');
      expect(rows).toHaveLength(1);
    });
  });

  describe("db:setup", () => {
    it("migrates and seeds", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      runtime.vfs.write(
        "db/seeds.ts",
        `await adapter.executeMutation('INSERT INTO "users" ("name") VALUES (?)', ["Bob"]);`,
      );

      await runtime.exec("db:setup");
      expect(runtime.getTables()).toContain("users");
      const rows = await runtime.adapter.execute('SELECT * FROM "users"');
      expect(rows).toHaveLength(1);
    });
  });

  describe("db:reset", () => {
    it("drops, migrates, and seeds", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      runtime.vfs.write(
        "db/seeds.ts",
        `await adapter.executeMutation('INSERT INTO "users" ("name") VALUES (?)', ["Charlie"]);`,
      );
      await runtime.exec("db:setup");
      await runtime.adapter.executeMutation('INSERT INTO "users" ("name") VALUES (?)', ["Extra"]);

      await runtime.exec("db:reset");
      const rows = await runtime.adapter.execute('SELECT * FROM "users"');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Charlie");
    });
  });

  describe("db:drop", () => {
    it("drops all tables", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      await runtime.exec("db:migrate");
      await runtime.exec("db:drop");
      expect(runtime.getTables()).not.toContain("users");
    });
  });

  describe("db:schema:dump", () => {
    it("writes schema to VFS", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      await runtime.exec("db:migrate");
      await runtime.exec("db:schema:dump");

      const schema = runtime.vfs.read("db/schema.sql");
      expect(schema).not.toBeNull();
      expect(schema!.content).toContain("users");
    });
  });

  describe("full workflow: new -> generate -> migrate -> seed", () => {
    it("creates a complete app from scratch", async () => {
      await runtime.exec("new my-blog");
      await runtime.exec("g model User name:string email:string");
      await runtime.exec("g model Post title:string body:text user_id:integer");

      // Verify migration files exist
      const migrationFiles = runtime.vfs.list().filter((f) => f.path.startsWith("db/migrations/"));
      expect(migrationFiles.length).toBe(2);

      const result = await runtime.exec("db:migrate");
      if (!result.success) console.log("migrate output:", result.output);

      expect(runtime.getTables()).toContain("users");
      expect(runtime.getTables()).toContain("posts");
      expect(runtime.vfs.read("app/models/user.ts")).not.toBeNull();
      expect(runtime.vfs.read("app/models/post.ts")).not.toBeNull();

      // Check status
      const status = await runtime.exec("db:migrate:status");
      expect(status.output.filter((l) => l.includes("  up  "))).toHaveLength(2);
    });
  });

  describe("sql command", () => {
    it("executes inline SQL", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      await runtime.exec("db:migrate");
      await runtime.adapter.executeMutation('INSERT INTO "users" ("name") VALUES (?)', ["Alice"]);

      const result = await runtime.exec('sql SELECT * FROM "users"');
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("Alice"))).toBe(true);
    });

    it("executes a .sql file from VFS", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      await runtime.exec("db:migrate");
      await runtime.adapter.executeMutation('INSERT INTO "users" ("name") VALUES (?)', ["Bob"]);

      runtime.vfs.write("queries/test.sql", 'SELECT * FROM "users"');
      const result = await runtime.exec("sql queries/test.sql");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("Bob"))).toBe(true);
    });

    it("executes multi-statement SQL files", async () => {
      runtime.adapter.execRaw('CREATE TABLE "t" ("n" INTEGER)');
      runtime.vfs.write(
        "multi.sql",
        `INSERT INTO "t" VALUES (1);\nINSERT INTO "t" VALUES (2);\nSELECT * FROM "t"`,
      );

      const result = await runtime.exec("sql multi.sql");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("2 row"))).toBe(true);
    });

    it("reports SQL errors", async () => {
      const result = await runtime.exec('sql SELECT * FROM "nonexistent"');
      expect(result.success).toBe(true); // command succeeds, but output shows error
      expect(result.output.some((l) => l.includes("ERROR"))).toBe(true);
    });
  });

  describe("run command", () => {
    it("runs a .ts file", async () => {
      runtime.vfs.write("test.ts", 'return "hello from test"');
      const result = await runtime.exec("run test.ts");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("hello from test"))).toBe(true);
    });

    it("runs a .sql file", async () => {
      runtime.adapter.execRaw('CREATE TABLE "t" ("v" TEXT)');
      runtime.adapter.execRaw(`INSERT INTO "t" VALUES ('hi')`);
      runtime.vfs.write("q.sql", 'SELECT * FROM "t"');

      const result = await runtime.exec("run q.sql");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("hi"))).toBe(true);
    });

    it("reports missing files", async () => {
      const result = await runtime.exec("run nope.ts");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("not found"))).toBe(true);
    });
  });

  describe("sample command", () => {
    it("lists available samples when no name given", async () => {
      const result = await runtime.exec("sample");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("bookstore"))).toBe(true);
      expect(result.output.some((l) => l.includes("music"))).toBe(true);
      expect(result.output.some((l) => l.includes("national-parks"))).toBe(true);
      expect(result.output.some((l) => l.includes("recipes"))).toBe(true);
    });

    it("loads the bookstore sample", async () => {
      const result = await runtime.exec("sample bookstore");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("Created"))).toBe(true);

      // Tables should exist
      const tables = runtime.getTables();
      expect(tables).toContain("authors");
      expect(tables).toContain("books");
      expect(tables).toContain("reviews");

      // Data should be populated
      const books = await runtime.adapter.execute('SELECT COUNT(*) as c FROM "books"');
      expect(books[0].c as number).toBeGreaterThan(10);
    });

    it("creates query files for the sample", async () => {
      await runtime.exec("sample bookstore");
      const overview = runtime.vfs.read("queries/bookstore/overview.sql");
      expect(overview).not.toBeNull();
      expect(overview!.content).toContain("SELECT");
    });

    it("query files are executable via sql command", async () => {
      await runtime.exec("sample bookstore");
      const result = await runtime.exec("sql queries/bookstore/overview.sql");
      expect(result.success).toBe(true);
      // Should have output with row counts
      expect(result.output.some((l) => /\d+ row/.test(l))).toBe(true);
    });

    it("loads the national-parks sample", async () => {
      await runtime.exec("sample national-parks");
      const tables = runtime.getTables();
      expect(tables).toContain("parks");
      expect(tables).toContain("trails");
      expect(tables).toContain("wildlife");
    });

    it("loads the recipes sample", async () => {
      await runtime.exec("sample recipes");
      const recipes = await runtime.adapter.execute('SELECT * FROM "recipes"');
      expect(recipes.length).toBeGreaterThan(5);
    });

    it("reports unknown sample", async () => {
      const result = await runtime.exec("sample nonexistent");
      expect(result.success).toBe(true);
      expect(result.output.some((l) => l.includes("Unknown sample"))).toBe(true);
    });
  });

  describe("exec in user code", () => {
    it("exec() works as a global", async () => {
      writeMigration("20240101000001", "CreateUsers", "users");
      const result = await runtime.executeCode(`return await exec("db:migrate")`);
      expect((result as any).success).toBe(true);
      expect(runtime.getTables()).toContain("users");
    });
  });

  describe("unknown command", () => {
    it("shows help", async () => {
      const result = await runtime.exec("bogus");
      expect(result.success).toBe(false);
      expect(result.output.some((l) => l.includes("Available commands"))).toBe(true);
    });
  });
});
