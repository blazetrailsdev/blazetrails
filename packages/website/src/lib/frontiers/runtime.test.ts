import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { createRuntime, type Runtime } from "./runtime.js";

let SQL: SqlJsStatic;
let runtime: Runtime;

beforeAll(async () => {
  SQL = await initSqlJs();
});

beforeEach(async () => {
  runtime = await createRuntime(SQL);
});

describe("createRuntime", () => {
  it("creates a runtime with adapter and vfs", () => {
    expect(runtime.adapter).toBeDefined();
    expect(runtime.vfs).toBeDefined();
  });

  it("vfs is backed by the adapter", () => {
    runtime.vfs.write("test.ts", "hello");
    expect(runtime.vfs.read("test.ts")?.content).toBe("hello");
  });
});

describe("exec: new", () => {
  it("creates app scaffold files", async () => {
    const result = await runtime.exec("new myapp");
    expect(result.success).toBe(true);
    expect(result.output.join("\n")).toContain("create  app/main.ts");
    expect(runtime.vfs.exists("app/main.ts")).toBe(true);
    expect(runtime.vfs.exists("config/routes.ts")).toBe(true);
    expect(runtime.vfs.exists("db/seeds.ts")).toBe(true);
  });

  it("clears existing files", async () => {
    runtime.vfs.write("old-file.ts", "old");
    await runtime.exec("new myapp");
    expect(runtime.vfs.exists("old-file.ts")).toBe(false);
  });
});

describe("exec: generate model", () => {
  it("creates model and migration files", async () => {
    await runtime.exec("new myapp");
    const result = await runtime.exec("generate model User name:string email:string");
    expect(result.success).toBe(true);

    const modelFile = runtime.vfs.read("app/models/user.ts");
    expect(modelFile).not.toBeNull();
    expect(modelFile!.content).toContain("class User extends Base");
    expect(modelFile!.content).toContain('this.attribute("name", "string")');
    expect(modelFile!.content).toContain('this.attribute("email", "string")');

    const migFiles = runtime.vfs
      .list()
      .filter((f) => f.path.startsWith("db/migrations/") && f.path.includes("create-users"));
    expect(migFiles.length).toBe(1);
    expect(migFiles[0].content).toContain("CreateUsers");
    expect(migFiles[0].content).toContain('t.string("name")');
    expect(migFiles[0].content).toContain('t.string("email")');
  });

  it("g is an alias for generate", async () => {
    await runtime.exec("new myapp");
    const result = await runtime.exec("g model Post title:string");
    expect(result.success).toBe(true);
    expect(runtime.vfs.exists("app/models/post.ts")).toBe(true);
  });
});

describe("exec: sql", () => {
  it("executes inline SQL", async () => {
    runtime.adapter.execRaw("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
    runtime.adapter.execRaw("INSERT INTO users (name) VALUES ('Alice')");

    const result = await runtime.exec("sql SELECT * FROM users");
    expect(result.success).toBe(true);
    expect(result.output.join("\n")).toContain("Alice");
  });

  it("executes SQL from a VFS file", async () => {
    runtime.adapter.execRaw("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
    runtime.adapter.execRaw("INSERT INTO users (name) VALUES ('Bob')");
    runtime.vfs.write("queries/test.sql", "SELECT * FROM users");

    const result = await runtime.exec("sql queries/test.sql");
    expect(result.success).toBe(true);
    expect(result.output.join("\n")).toContain("Bob");
  });
});

describe("exec: db:drop", () => {
  it("drops all tables", async () => {
    runtime.adapter.execRaw("CREATE TABLE users (id INTEGER PRIMARY KEY)");
    runtime.adapter.execRaw("CREATE TABLE posts (id INTEGER PRIMARY KEY)");
    expect(runtime.getTables()).toContain("users");

    const result = await runtime.exec("db:drop");
    expect(result.success).toBe(true);
    expect(runtime.getTables().filter((t) => !t.startsWith("_vfs_"))).toHaveLength(0);
  });
});

describe("exec: unknown command", () => {
  it("returns error with available commands", async () => {
    const result = await runtime.exec("foobar");
    expect(result.success).toBe(false);
    expect(result.output.join("\n")).toContain("Unknown command");
    expect(result.output.join("\n")).toContain("Available commands");
  });
});

describe("runtime utilities", () => {
  it("executeSQL delegates to adapter", () => {
    runtime.adapter.execRaw("CREATE TABLE t (id INTEGER)");
    const results = runtime.executeSQL("SELECT * FROM t");
    expect(results).toBeDefined();
  });

  it("getTables returns table names", () => {
    runtime.adapter.execRaw("CREATE TABLE users (id INTEGER)");
    expect(runtime.getTables()).toContain("users");
  });

  it("reset clears everything", () => {
    runtime.adapter.execRaw("CREATE TABLE users (id INTEGER)");
    runtime.vfs.write("test.ts", "hello");
    runtime.reset();
    expect(runtime.getTables().filter((t) => !t.startsWith("_vfs_"))).toHaveLength(0);
    expect(runtime.vfs.list()).toHaveLength(0);
  });
});
