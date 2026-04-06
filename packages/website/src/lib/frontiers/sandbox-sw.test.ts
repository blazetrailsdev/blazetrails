import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import { VirtualFS } from "./virtual-fs.js";

/**
 * Tests for the SW message handler logic.
 * Since we can't run a real ServiceWorker in vitest, we test the handleSwMessage
 * function by importing it directly. The SW module has side effects (addEventListener),
 * so instead we test the core logic indirectly via the exported modules.
 */

describe("sandbox-sw message handling", () => {
  let adapter: SqlJsAdapter;
  let vfs: VirtualFS;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    adapter = new SqlJsAdapter(db);
    vfs = new VirtualFS(adapter);
  });

  describe("VFS operations", () => {
    it("writes and reads files", () => {
      vfs.write("app/models/user.ts", "export class User {}");
      const file = vfs.read("app/models/user.ts");
      expect(file).not.toBeNull();
      expect(file!.content).toBe("export class User {}");
    });

    it("lists files", () => {
      vfs.write("a.ts", "a");
      vfs.write("b.ts", "b");
      const files = vfs.list();
      expect(files).toHaveLength(2);
    });

    it("deletes files", () => {
      vfs.write("a.ts", "a");
      expect(vfs.delete("a.ts")).toBe(true);
      expect(vfs.read("a.ts")).toBeNull();
    });

    it("renames files", () => {
      vfs.write("old.ts", "content");
      expect(vfs.rename("old.ts", "new.ts")).toBe(true);
      expect(vfs.read("old.ts")).toBeNull();
      expect(vfs.read("new.ts")!.content).toBe("content");
    });

    it("checks existence", () => {
      vfs.write("exists.ts", "yes");
      expect(vfs.exists("exists.ts")).toBe(true);
      expect(vfs.exists("nope.ts")).toBe(false);
    });
  });

  describe("DB operations", () => {
    it("lists tables (excluding _vfs_ tables)", () => {
      adapter.runSql('CREATE TABLE "users" ("id" INTEGER PRIMARY KEY, "name" TEXT)');
      const tables = adapter.getTables().filter((t) => !t.startsWith("_vfs_"));
      expect(tables).toContain("users");
    });

    it("gets columns", () => {
      adapter.runSql('CREATE TABLE "users" ("id" INTEGER PRIMARY KEY, "name" TEXT NOT NULL)');
      const cols = adapter.getColumns("users");
      expect(cols).toHaveLength(2);
      expect(cols[0].name).toBe("id");
      expect(cols[1].name).toBe("name");
      expect(cols[1].notnull).toBe(true);
    });

    it("executes raw SQL", () => {
      adapter.runSql('CREATE TABLE "users" ("id" INTEGER PRIMARY KEY, "name" TEXT)');
      adapter.runSql(`INSERT INTO "users" VALUES (1, 'dean')`);
      const results = adapter.execRaw('SELECT * FROM "users"');
      expect(results).toHaveLength(1);
      expect(results[0].columns).toEqual(["id", "name"]);
      expect(results[0].values).toEqual([[1, "dean"]]);
    });
  });

  describe("CLI execution", () => {
    it("trail-cli accepts generate model command", async () => {
      const { createTrailCLI } = await import("./trail-cli.js");
      const migrations: any[] = [];
      const cli = createTrailCLI({
        vfs,
        adapter,
        executeCode: async () => {},
        getMigrations: () => migrations,
        registerMigration: (m: any) => migrations.push(m),
        clearMigrations: () => {
          migrations.length = 0;
        },
        getTables: () => adapter.getTables(),
      });

      const result = await cli.exec("generate model User name:string email:string");
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      // Should have created migration and model files
      const files = vfs.list();
      expect(files.some((f) => f.path.includes("user"))).toBe(true);
    });
  });
});
